package ws

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nosyash/backrow/cache"
	"github.com/nosyash/backrow/jwt"
)

const (
	exitNormal = iota
	exitClosed
	exitUpdateHead
)

var errNotHavePermissions = errors.New("You don't have permissions to do this action")

var delLock sync.Mutex
var pauseLock sync.Mutex
var resumeLock sync.Mutex
var rewindLock sync.Mutex
var moveLock sync.Mutex

const (
	syncPeriod       = 3
	sleepBeforeStart = 3
)

func (h *hub) handlePlayerEvent(req *packet, conn *websocket.Conn) {
	// For now, only users can do this actions
	if req.Payload == nil {
		sendFeedBack(conn, &feedback{
			Error: errNotHavePermissions.Error(),
		})
		return
	}

	switch req.Body.Event.Type {
	case eTypePlAdd:
		var fb feedback
		var video cache.NewVideo

		if req.Body.Event.Data.URL != "" {
			video.URL = req.Body.Event.Data.URL
			video.Subtitles = req.Body.Event.Data.Subtitles
			video.SubtitlesURL = req.Body.Event.Data.SubtitlesURL
			video.SubtitlesType = req.Body.Event.Data.SubtitlesType

			h.cache.Playlist.AddVideo <- &video
		} else {
			fb.Error = errors.New("Video url is empty").Error()
			sendFeedBack(conn, &fb)
			return
		}

		if err := <-h.cache.Playlist.AddFeedBack; err != nil {
			fb.Error = err.Error()
			fb.URL = req.Body.Event.Data.URL
		} else {
			fb.Message = "success"
			fb.URL = req.Body.Event.Data.URL
		}

		sendFeedBack(conn, &fb)

	case eTypePlDel:
		ID := req.Body.Event.Data.ID
		if ID != "" && len(ID) == 64 {

			delLock.Lock()

			if h.syncer.currentVideoID == ID {
				h.syncer.skip <- struct{}{}
				delLock.Unlock()
				return
			}

			delLock.Unlock()

			h.cache.Playlist.DelVideo <- ID

			if err := <-h.cache.Playlist.DelFeedBack; err != nil {
				sendFeedBack(conn, &feedback{
					Error: err.Error(),
				})
			}
		} else {
			sendError(conn, errors.New("Video ID is empty"))
		}
	case eTypePause:
		pauseLock.Lock()

		if !h.syncer.isPause && !h.syncer.isSleep && !h.syncer.isStreamOrFrame {
			if result := h.checkPermissions(conn, req.Payload, eTypePause); result {
				h.syncer.pause <- struct{}{}

				h.broadcast <- createPacket(playerEvent, eTypePause, nil)
				h.syncer.isPause = true
			}
		}

		pauseLock.Unlock()
	case eTypeResume:
		resumeLock.Lock()

		if h.syncer.isPause && !h.syncer.isSleep && !h.syncer.isStreamOrFrame {
			if result := h.checkPermissions(conn, req.Payload, eTypeResume); result {
				h.syncer.resume <- struct{}{}

				h.broadcast <- createPacket(playerEvent, eTypeResume, nil)
				h.syncer.isPause = false
			}
		}

		resumeLock.Unlock()

	case eTypeRewind:
		if !h.syncer.isSleep && !h.syncer.isStreamOrFrame {
			if result := h.checkPermissions(conn, req.Payload, eTypeRewind); result {
				if h.syncer.isPause {
					rewindLock.Lock()
					h.syncer.rewindAfterPause = req.Body.Event.Data.RewindTime
					rewindLock.Unlock()

					break
				}
				h.syncer.rewind <- req.Body.Event.Data.RewindTime
			}
		}
	case eTypeMove:
		if !h.syncer.isSleep {
			if result := h.checkPermissions(conn, req.Payload, eTypeMove); result {
				h.cache.Playlist.MoveVideo <- cache.MoveVideo{
					ID:    req.Body.Event.Data.ID,
					Index: req.Body.Event.Data.Index,
				}

				if r := <-h.cache.Playlist.MoveFeedBack; r == cache.MoveHead {
					h.syncer.move <- struct{}{}
				}
			}
		}
	}
}

func (h hub) updatePlaylist() {
	packet := playlist{
		Action: playlistEvent,
		Body: plBody{
			Event: plEvent{
				Type: eTypePlaylistUpd,
				Data: plData{
					Playlist: h.cache.Playlist.GetAllPlaylist(),
				},
			},
		},
	}

	data, _ := json.Marshal(&packet)
	h.broadcast <- data
}

func (h *hub) syncElapsedTime() {
	for {
		if h.cache.Playlist.Size() == 0 {
			if r := h.waitUpdates(); r {
				return
			}
		}

		video := h.cache.Playlist.TakeHeadElement()
		h.syncer.currentVideoID = video.ID

		if video.Iframe || video.LiveStream {
			if r := h.handleIframeOrStream(video.ID); r {
				return
			}

			continue
		}

		switch h.elapsedTicker(video) {
		case exitClosed:
			return
		case exitNormal:
			h.syncer.currentVideoID = ""
			h.cache.Playlist.DelVideo <- video.ID
			<-h.cache.Playlist.DelFeedBack
		case exitUpdateHead:
			continue
		}
	}
}

func (h *hub) waitUpdates() bool {
	h.syncer.isSleep = true

	for {
		select {
		case <-h.syncer.wakeUp:
			h.syncer.isSleep = false
			return false
		case <-h.syncer.close:
			return true
		}
	}
}

func (h *hub) handleIframeOrStream(id string) bool {
	for {
		select {
		case <-h.syncer.skip:
			h.syncer.isStreamOrFrame = false
			h.syncer.currentVideoID = ""
			h.cache.Playlist.DelVideo <- id
			<-h.cache.Playlist.DelFeedBack

			return false
		case <-h.syncer.move:
			return false
		case <-h.syncer.close:
			return true
		}
	}
}

func (h *hub) elapsedTicker(video *cache.Video) int {
	var ep elapsedTime
	var d data
	var elapsed int
	var ticker = time.Tick(syncPeriod * time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(video.Duration+sleepBeforeStart)*time.Second)
	time.Sleep(sleepBeforeStart)

	for {
		select {
		case <-ticker:
			ep.ID = video.ID
			ep.Duration = video.Duration
			ep.ElapsedTime = elapsed

			d.Ticker = &ep

			h.broadcast <- createPacket(playerEvent, eTypeTicker, &d)

			elapsed += syncPeriod
			h.syncer.elapsed = elapsed
		case <-h.syncer.pause:
			if r := h.pauseTicker(); r {
				cancel()
				return exitClosed
			}
			if h.syncer.rewindAfterPause > 0 && h.syncer.rewindAfterPause < video.Duration {
				elapsed = h.syncer.rewindAfterPause
			}
			ctx, cancel = context.WithDeadline(context.Background(), time.Now().Add(time.Duration(video.Duration-elapsed+sleepBeforeStart)*time.Second))
		case e := <-h.syncer.rewind:
			if e > 0 && e < video.Duration {
				elapsed = e
				ctx, cancel = context.WithDeadline(context.Background(), time.Now().Add(time.Duration(video.Duration-elapsed+sleepBeforeStart)*time.Second))
			}
		case <-h.syncer.skip:
			cancel()
			return exitNormal
		case <-h.syncer.move:
			cancel()
			return exitUpdateHead
		case <-ctx.Done():
			cancel()
			return exitNormal
		case <-h.syncer.close:
			cancel()
			return exitClosed
		}
	}
}

func (h *hub) pauseTicker() bool {
	for {
		select {
		case <-h.syncer.resume:
			return false
		case <-h.syncer.close:
			return true
		}
	}
}

func (h hub) checkPermissions(conn *websocket.Conn, payload *jwt.Payload, eType string) bool {
	return true
}
