import * as types from '../constants/ActionTypes';
import {
  ADD_MEDIA,
  COLOR_PICKER,
  GUEST_AUTH,
  IMAGE_PICKER,
  LOG_FORM,
  NEW_ROOM,
  PLAYLIST,
  PROFILE_SETTINGS,
  SETTINGS,
} from '../constants';

const initialState = {
  list: [],
  [ADD_MEDIA]: false,
  [COLOR_PICKER]: false,
  [GUEST_AUTH]: false,
  [IMAGE_PICKER]: false,
  [LOG_FORM]: false,
  [NEW_ROOM]: false,
  [PLAYLIST]: false,
  [PROFILE_SETTINGS]: false,
  [SETTINGS]: false,
};

const Popups = (state = initialState, action) => {
  switch (action.type) {
    case types.ADD_POPUP: {
      return { ...state, [action.payload]: true };
    }
    // }

    case types.REMOVE_POPUP: {
      return { ...state, [action.payload]: false };
    }

    case types.TOGGLE_POPUP: {
      return { ...state, [action.payload]: !state[action.payload] };
    }

    case types.CLEAR_POPUPS: {
      return { ...initialState };
    }

    default:
      return state;
  }
};

export default Popups;
