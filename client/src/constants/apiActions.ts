/* eslint-disable camelcase */
import { API_ENDPOINT } from '../constants';
import { Message } from '../utils/types';
import { PasswordChange, WebSocketRegister, WebSocketGuestRegister, SendMediaToPlaylist, DeleteMediaFromPlaylist } from './types';
import { getCookie } from '../utils';

export const API_AUTH = () => `${API_ENDPOINT}/auth`;
export const API_ROOM = (roomID: string) => `${API_ENDPOINT}/r/${roomID}`;
export const API_ROOMS = () => `${API_ENDPOINT}/room`;
export const API_USER = () => `${API_ENDPOINT}/user`;

export const ROOM_CREATE = (title: string, path: string) =>
    JSON.stringify({
        action: 'room_create',
        body: { title, path },
    } as Message);

export const LOG_IN = (uname: string, passwd: string, email: string) =>
    JSON.stringify({
        action: 'login',
        body: { uname, passwd, email },
    } as Message);

export const REG = (uname: string, passwd: string, email: string) =>
    JSON.stringify({
        action: 'register',
        body: { uname, passwd, email },
    } as Message);

export const UPDATE_IMAGE = (raw_img: string) =>
    JSON.stringify({
        action: 'user_update_img',
        body: {
            image: {
                raw_img,
            },
        },
    } as Message);

export const UPDATE_USER = (name = '', color = '') =>
    JSON.stringify({
        action: 'user_update_per',
        body: {
            name,
            color,
        },
    } as Message);

export const UPDATE_PASSWORD = ({ cur_passwd, new_passwd }: PasswordChange) =>
    JSON.stringify({
        action: 'user_update_pswd',
        body: {
            cur_passwd,
            new_passwd,
        },
    } as Message);

// ####################
//      WebSocket
// ####################
export const USER_REGISTER = (room_uuid: string, user_uuid?: string) =>
    JSON.stringify({
        action: 'user_register',
        room_uuid,
        jwt: getCookie('jwt'),
    } as WebSocketRegister);

export const GUEST_REGISTER = (room_uuid: string, user_uuid: string, name: string) =>
    JSON.stringify({
        action: 'guest_register',
        room_uuid,
        name,
        user_uuid,
    } as WebSocketGuestRegister);

export const SEND_MESSAGE = (message: string, user_uuid?: string) =>
    JSON.stringify({
        action: 'user_event',
        body: {
            event: {
                type: 'message',
                data: {
                    message,
                },
            },
        },
        user_uuid,
        jwt: getCookie('jwt'),
    } as Message);

export const GET_ERROR = (string: string) => {
    const obj = JSON.parse(string);
    if (obj.error) return obj.error;
};

// export const SEND_MEDIA_TO_PLAYLIST_WITH_SUBS = ({ url, uuid }) => {
//     const request = {
//         action: "player_event",
//         body: {
//             event: {
//                 type: "playlist_add",
//                 data: {
//                     url: "https://up.bona.cafe/src/54/4ed8190abce24f2b4ce73df845ef1f4f6f031e.webm",
//                     subtitles: "bonan_durek",
//                     subs_type: "srt"
//                 }
//             }
//         },
//         jwt: getCookie('jwt'),
//     }
// }

export const SEND_MEDIA_TO_PLAYLIST = ({ url, subtitles = {}, uuid }: { url: string; uuid?: string; subtitles?: any }) => {
    const request = {
        action: 'playlist_event',
        body: {
            event: {
                type: 'playlist_add',
                data: {
                    url,
                    ...subtitles,
                },
            },
        },
        jwt: getCookie('jwt'),
    } as SendMediaToPlaylist;

    return JSON.stringify(request);
};

export const DELETE_VIDEO_FROM_PLAYLIST = ({ __id, uuid }: { __id: string; uuid?: string }) => {
    const request = {
        action: 'playlist_event',
        body: {
            event: {
                type: 'playlist_del',
                data: {
                    __id,
                },
            },
        },
        jwt: getCookie('jwt'),
    } as DeleteMediaFromPlaylist;

    return JSON.stringify(request);
};

export const REORDER_MEDIA = ({ __id, index }: { __id: string; index: number }) => {
    const request = {
        action: 'playlist_event',
        body: {
            event: {
                type: 'move',
                data: {
                    __id: __id,
                    index: index
                }
            }
        },
        jwt: getCookie('jwt'),
    }

    return JSON.stringify(request)
}

export const REWIND_MEDIA = ({ time = 0 }: { time: number }) => {
    const request = {
        action: 'player_event',
        body: {
            event: {
                type:'rewind',
                data: {
                    time: parseInt(time.toString(), 10),
                }
            }
        },
        jwt: getCookie('jwt'),
    }

    return JSON.stringify(request)
}

export const PAUSE_MEDIA = () => {
    const request = {
        action: 'player_event',
        body: {
            event: {
                type:'pause',
            }
        },
        jwt: getCookie('jwt'),
    }

    return JSON.stringify(request)
}

export const RESUME_MEDIA = () => {
    const request = {
        action: 'player_event',
        body: {
            event: {
                type:'resume',
            }
        },
        jwt: getCookie('jwt'),
    }

    return JSON.stringify(request)
}

export interface AddEmoteRequest {
    name: string;
    type: 'png' | 'gif';
    base64: string;
    room_uuid?: string;
}

const getEmoteName = (name: string) =>
    name
        .substr(0, 15)
        .replace(/\.\w+$/, '')
        .replace(/[^a-z0-9_]/gi, '') || 'emote' + Math.round(Math.random() * 10000)

export const ADD_EMOTE = ({ name, type, base64, room_uuid }: AddEmoteRequest) => {
    const request = {
        action: 'room_update',
        body: {
            type: 'add_emoji',
            data: {
                name: getEmoteName(name),
                type,
                raw_img: base64.replace(/^data:.+;base64,/, ''),
            }
        },
        room_uuid,

    }
    return JSON.stringify(request);
}

export const REMOVE_EMOTE = ({ name, room_uuid }) => {
    const request = {
        action: 'room_update',
        body: {
            type: 'del_emoji',
            data: {
                name,
            }
        },
        room_uuid,
    }
    return JSON.stringify(request);
}



export const RENAME_EMOTE = ({ name, newname, room_uuid }) => {
    const request = {
        action: 'room_update',
        body: {
            type: 'change_emoji_name',
            data: {
                name,
                new_name: newname
            }
        },
        room_uuid
    }

    return JSON.stringify(request);
}
