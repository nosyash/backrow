import get from 'lodash-es/get';
import throttle from 'lodash-es/throttle';
import * as api from '../constants/apiActions';
import * as types from '../constants/actionTypes';
import { store } from '../store';
import { toast } from 'react-toastify';
import { toastOpts } from '../conf';
import {
    Message,
    ChatMessage,
    TickerData,
    UpdatePlaylistData,
    UpdateUsersData,
    FeedbackData,
    MessageType
} from './types';
import { User } from './types';
import { Store } from 'redux';
import { Emoji } from '../reducers/emojis';
import httpServices from './httpServices';
import { wait, safelyParseJson } from '.';
import { DEBUG, MAX_MESSAGES } from '../constants';
import {
    UPDATE_PLAYLIST_WS_DEBUG_MESSAGE,
    PAUSE_MEDIA_WS_DEBUG_MESSAGE,
    TICKER_WS_DEBUG_MESSAGE,
    DEBUG_EXPOSE,
    RESUME_MEDIA_WS_DEBUG_MESSAGE
} from './__DEBUG__';
import { workerRequest } from '../worker';
import { State } from '../reducers';

const { dispatch, getState } = store as Store;

export interface SocketInterface {
    instance: WebSocket;
    url: string;
    guest: boolean;
    name: string;
    room_uuid: string;
    uuid: string;
    timer: NodeJS.Timeout;
    reconnectTimer: NodeJS.Timeout;
}

class Socket implements SocketInterface {
    instance: WebSocket;
    url: string;
    guest: boolean;
    name: string;
    room_uuid: string;
    uuid: string;
    timer: NodeJS.Timeout;
    timer2: NodeJS.Timeout;
    reconnectTimer: NodeJS.Timeout;
    lastTime: number;
    tempMessages: any[]
    messagesCheckTimeout: number
    constructor(props: SocketInterface) {
        this.url = props.url;
        this.guest = props.guest;
        this.name = props.name;
        this.room_uuid = props.room_uuid;
        this.uuid = props.uuid;

        this.timer = null;
        this.timer2 = null;
        this.reconnectTimer = null;
        this.initWebSocket();

        this.lastTime = Date.now()
        this.tempMessages = []
        this.messagesCheckTimeout = 150

        this.watchMessages()
        this.initEvents()

        DEBUG_EXPOSE('WEBSOCKET', this)
    }

    public initWebSocket = () => {
        dispatch({ type: types.CLEAR_MESSAGE_LIST })
        this.resetStates();
        this.instance = new WebSocket(this.url);
        this.listen();
    };

    public isOpened = () => {
        if (!this.instance) {
            return false;
        }
        const { readyState } = this.instance;
        return this.getReadyState(readyState) === 'OPEN'
    }

    public state = () => {
        return new Promise((resolve, reject) => {
            this.timer = setInterval(() => {
                const { readyState } = this.instance;

                if (this.getReadyState(readyState) === 'CLOSED') {
                    dispatch({ type: types.SET_SOCKET_CONNECTED, payload: false });
                    dispatch({ type: types.SET_SOCKET_ERROR, payload: true });
                    clearInterval(this.timer);
                    reject();
                }
                if (this.getReadyState(readyState) === 'OPEN') {
                    clearInterval(this.timer);
                    resolve();
                }
            }, 50);

            setTimeout(() => {
                clearInterval(this.timer);
                reject();
            }, 15000);
        });
    };

    public sendMessage = async (data: string, expectedType?: string): Promise<void> => {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const removeEvent = () => {
                if (this.instance) this.instance.removeEventListener('message', onMessage);
            }

            this.instance.send(data);
            if (expectedType) {
                this.instance.addEventListener('message', onMessage);
                await wait(15000)
                removeEvent()
                return reject()
            }

            function onMessage({ data: receivedData }: any) {
                const _data = safelyParseJson(receivedData);
                // const type = get(_data, 'body.event.type')
                const { message, error } = get(_data, 'body.event.data.feedback', {})

                // if (type !== expectedType) {
                //     return;
                // }

                // if (message && message === 'success')
                if (message || error) {
                    removeEvent()
                }

                if (message) {
                    resolve()
                } else if (error) {
                    reject(error)
                }
            }


        })
    };

    public destroy = () => {
        this.unsubscribeEvents();
        if (this.instance) {
            this.instance.close();
        }
        this.resetStates();
    };

    private getReadyState = (readyState: number) => {
        switch (readyState) {
            case 0:
                return 'CONNECTING';
            case 1:
                return 'OPEN';
            case 2:
                return 'CLOSING';
            case 3:
                return 'CLOSED';

            default:
                break;
        }
    };

    private resetStates = () => {
        dispatch({ type: types.SET_SOCKET_CONNECTED, payload: false });
        dispatch({ type: types.SET_SOCKET_ERROR, payload: false });
    };

    private listen = () => {
        this.instance.onopen = () => this.handleOpen();
        this.instance.onmessage = data => this.handleMessage(data);
        this.instance.onerror = () => this.handleError();
        this.instance.onclose = () => this.handleClose();
    };

    private handleOpen = () => {
        console.log('WebSocket: opened');
        this.handleHandshake();
    };

    private handleHandshake() {
        if (!this.guest) {
            this.instance.send(api.USER_REGISTER(this.room_uuid, this.uuid));
        } else {
            const request = api.GUEST_REGISTER(this.room_uuid, this.uuid, this.name);
            this.instance.send(request);
        }
        dispatch({ type: types.SET_SOCKET_CONNECTED, payload: true });
    }

    private addMessages = (payload: any[]) => dispatch({ type: types.ADD_MESSAGES, payload });

    private addCollectedMessages = () => {
        this.addMessages(this.tempMessages)
        // console.log(this.tempMessages.length)
        const len = this.tempMessages.length
        if (len < 10) this.messagesCheckTimeout = 100
        if (len > 10 && len < 20) this.messagesCheckTimeout = 500
        if (len > 20 && len < 30) this.messagesCheckTimeout = 500
        if (len > 30 && len < 50) this.messagesCheckTimeout = 1000
        if (len > 50 && len < 100) this.messagesCheckTimeout = 2000
        if (len > 100) this.messagesCheckTimeout = 4000
        this.tempMessages = []
        this.watchMessages()
    }

    private watchMessages() {
        setTimeout(() => {
            // this.addCollectedMessages()
        }, this.messagesCheckTimeout)
    }

    private initEvents() {
        document.addEventListener('websocketdata', this._handleMessage)
    }

    private handleMessage = ({ data }: MessageEvent) => {
        const { chat, emojis, profile } = getState() as State

        const context = { room_uuid: this.room_uuid, userList: chat.users, emojis: emojis.list, mainUserName: profile.name  }
        workerRequest.websocketData({ message: data, context })
    }

    private handleProxyMessage(data: any) {
        const text = get(data, 'error.message')
        if (text && !toast.isActive(text)) {
            toast.warn(text, { toastId: text, hideProgressBar: true, autoClose: 2000 })
        }
    }

    private _handleMessage = ({ detail }: CustomEvent) => {
        const { parsedData, payload, messageType } = detail.data

        const proxyServerMessage = get(parsedData, '__PROXY_SERVER__')
        if (proxyServerMessage) {
            return this.handleProxyMessage(proxyServerMessage)
        }

        switch (messageType) {
            case 'update_users': {
                const _data = get(parsedData, 'body.event.data') as UpdateUsersData;
                return dispatch({ type: types.UPDATE_USERLIST, payload: moveGuestsToTheEnd(_data.users) });
            }

            case 'message': {
                return dispatch({ type: types.ADD_MESSAGES, payload })
            }

            case 'resume': {
                return dispatch({ type: types.SET_REMOTE_PLAYING });
            }

            case 'pause': {
                return dispatch({ type: types.SET_REMOTE_PAUSED });
            }

            case 'update_playlist': {
                const playlistData = get(parsedData, 'body.event.data') as UpdatePlaylistData;

                const subtitlesUrl = get(playlistData, 'videos[0].subs') as string;
                if (subtitlesUrl) {
                    httpServices
                        .get(subtitlesUrl)
                        .then(handleSubtitles)
                        .catch(() => toast.error('Could not fetch subtitles'))
                }

                const dispatchAction = () => dispatch({ type: types.ADD_TO_PLAYLIST, payload: playlistData.videos });
                return this.handleMediaChange(playlistData, dispatchAction);
            }

            case 'ticker': {
                const { ticker } = get(parsedData, 'body.event.data') as TickerData;
                return dispatch({ type: types.UPDATE_MEDIA, payload: { actualTime: ticker.elapsed_time } });
            }

            case 'emoji_update': {
                const emoji = get(parsedData, 'body.event.data.emoji') as Emoji[];
                return dispatch({ type: types.ADD_EMOJIS, payload: emoji || [] });
            }

            case 'error': {
                const error = get(parsedData, 'body.event.data.error') as string;
                return toast.error(error, toastOpts);
            }

            case 'feedback': {
                const { feedback } = get(parsedData, 'body.event.data', {}) as FeedbackData;
                if (feedback.message === 'success') {
                    return setAddMediaToSuccess();
                }

                if (feedback.error) {
                    stopAddMediaPending()
                    toast.warn(feedback.error, toastOpts);
                }
                return;
            }

            default:
                break;
        }
    };

    private handleMediaChange(data: any, dispatch_: (...args: any) => void) {
        const state = getState();
        const mediaBefore = get(state, 'media.playlist[0]');
        const mediaAfter = get(data, 'videos[0]');

        const videoIdCurrent = get(mediaBefore, '__id');
        const videoIdNew = get(mediaAfter, '__id');

        const mediaBeforeChange = new CustomEvent('mediabeforechange', { 'detail': { mediaBefore, mediaAfter } });
        const mediaAfterChange = new CustomEvent('mediaafterchange', { 'detail': { mediaBefore, mediaAfter } });

        const changed = videoIdCurrent !== videoIdNew;
        if (changed) {
            document.dispatchEvent(mediaBeforeChange);
        }

        dispatch_();
        if (changed) {
            dispatch({ type: types.UPDATE_MEDIA, payload: { actualTime: 0 } });
            document.dispatchEvent(mediaAfterChange);
        }
    }

    private handleError = () => {
        this.handleReconnect();
    };

    private handleClose = () => {
        console.log('WebSocket: closed');
        this.handleReconnect();
    };

    private handleReconnect = () => {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.initWebSocket();
        }, 3000);
    };

    private unsubscribeEvents = () => {
        if (!this.instance) {
            return;
        }

        this.instance.onopen = () => null;
        this.instance.onmessage = () => null;
        this.instance.onerror = () => null;
        this.instance.onclose = () => null;
    };

    // _webSocketReconnect = () => {
    //   clearTimeout(this.timer);

    //   this.timer = setTimeout(() => {
    //     if (!this.pending) this._webSocketReconnect();
    //   }, WEBSOCKET_TIMEOUT);
    // };

    get __DEBUG__() {
        if (!DEBUG) {
            return null
        }

        return {
            addVideoAndPause: (n = 5000) => {
                this.__DEBUG__.addMedia();
                this.__DEBUG__.updateTicker(0);
                setTimeout(() => {
                    console.log('DEBUG: paused');
                    this.__DEBUG__.remotelyPauseVideo()
                }, n)
            },
            addMedia: (params?: any) => this.handleMessage(({ data: JSON.stringify(UPDATE_PLAYLIST_WS_DEBUG_MESSAGE(params)) }) as MessageEvent),
            remotelyPauseVideo: () => this.handleMessage(({ data: JSON.stringify(PAUSE_MEDIA_WS_DEBUG_MESSAGE()) }) as MessageEvent),
            remotelyResumeVideo: () => this.handleMessage(({ data: JSON.stringify(RESUME_MEDIA_WS_DEBUG_MESSAGE()) }) as MessageEvent),
            updateTicker: (n = 100) => this.handleMessage(({ data: JSON.stringify(TICKER_WS_DEBUG_MESSAGE(n)) }) as MessageEvent),
            runTicker: () => {
                let n = 0;
                setInterval(() => {
                    n += 5
                    this.__DEBUG__.updateTicker(n)
                }, 5000)
            }
        }
    }
}

// function subtitlesUpdateEvent() {
//     const subtitlesAftersChanged = new CustomEvent('subtitlesafterchange', { 'detail': {} });
//     document.dispatchEvent(subtitlesAftersChanged);
// }

function handleSubtitles({ data }) {
    dispatch({ type: types.SET_RAW_SUBS, payload: data })
    dispatch({ type: types.SHOW_SUBS })
    // workerRequest.subtitlesInit(data)
    // subtitlesUpdateEvent()
}

function moveGuestsToTheEnd(users: User[]) {
    if (!users) return [];
    const guests = users.filter(user => user.guest);
    const notGuests = users.filter(user => !user.guest);

    return [...notGuests, ...guests]
}

const stopAddMediaPending = () => {
    dispatch({ type: types.SET_ADD_MEDIA_PENDING, payload: false });
};

const setAddMediaToSuccess = () => {
    dispatch({ type: types.REMOVE_POPUP, payload: 'addMedia' });
    stopAddMediaPending();
};



export default Socket;
