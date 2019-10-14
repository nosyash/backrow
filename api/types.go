package api

import (
	"github.com/nosyash/backrow/db"
)

type message struct {
	Error   string `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
}

type authRequest struct {
	Action string   `json:"action"`
	Body   authBody `json:"body"`
}

type roomRequest struct {
	Action   string   `json:"action"`
	Body     roomBody `json:"body"`
	RoomUUID string   `json:"room_uuid"`
	RoomPath string   `json:"room_path"`
}

type userRequest struct {
	Action string   `json:"action"`
	Body   userBody `json:"body"`
}

type userBody struct {
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CurPasswd string    `json:"cur_passwd"`
	NewPasswd string    `json:"new_passwd"`
	Image     imageBody `json:"image"`
}

type imageBody struct {
	Img     string `json:"raw_img"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	NewName string `json:"new_name,omitempty"`
}

type roomBody struct {
	UpdateType string    `json:"type"`
	Title      string    `json:"title"`
	Path       string    `json:"path"`
	Hidden     bool      `json:"hidden"`
	Password   string    `json:"passwd"`
	ID         string    `json:"id"`
	Level      int       `json:"level"`
	Action     string    `json:"action"`
	Data       imageBody `json:"data"`
}

type authBody struct {
	Uname  string `json:"uname"`
	Passwd string `json:"passwd"`
	Name   string `json:"name"`
	Email  string `json:"email"`
}

type roomView struct {
	Title       string         `json:"title,omitempty"`
	UUID        string         `json:"uuid,omitempty"`
	Emoji       []db.Emoji     `json:"emoji,omitempty"`
	Permissions db.Permissions `json:"permissions"`
}

type bannedList struct {
	BannedUsers []db.BannedUsers `json:"users"`
	BannedIps   []db.BannedIps   `json:"ips"`
}

const (
	eTypeAccountRegistration = "register"
	eTypeAccountLogin        = "login"
	eTypeAccountLogout       = "logout"
	eTypeAccountUpdate       = "update"
)

const (
	eTypeRoomCreate = "room_create"
	eTypeRoomUpdate = "room_update"
	eTypeRoomDelete = "room_delete"
	eTypeAuthInRoom = "room_auth"
)

const (
	eTypeChangeTitle    = "change_title"
	eTypeChangePath     = "change_path"
	eTypeDeleteRoom     = "delete_room"
	eTypeAddEmoji       = "add_emoji"
	eTypeDelEmoji       = "del_emoji"
	eTypeChangeEmojname = "change_emoji_name"

	eTypeAddRole          = "add_role"
	eTypeChangePermission = "change_permission"
)

const (
	eTypeUserUpdateImg  = "user_update_img"
	eTypeUserDeleteImg  = "user_delete_img"
	eTypeUserUpdatePer  = "user_update_per"
	eTypeUserUpdatePswd = "user_update_pswd"
)

const (
	ownerLevel      = 6
	coOwnerLevel    = 5
	moderatorLevel  = 4
	jModeratorLevel = 3
	djUser          = 2
	user            = 1
	guest           = 0
)

const (
	minUsernameLength = 1
	maxUsernameLength = 20

	minPasswordLength = 8
	maxPasswordLength = 32

	minNameLength = 1
	maxNameLength = 20
)

const (
	minRoomTitleLength = 4
	maxRoomTitleLength = 30

	minRoomPathLength = 4
	maxRoomPathLength = 15
)

const (
	minEmojiNameLength = 2
	maxEmojiNameLength = 15
)

const (
	maxOwnersCount = 15
	maxEmojiCount  = 100
)

const (
	profileImgWidth  = 500
	profileImgHeight = 500

	maxEmojiImgWidth  = 128
	maxEmojiImgHeight = 128

	minEmojiImgWidth  = 32
	minEmojiImgHeight = 32
)
