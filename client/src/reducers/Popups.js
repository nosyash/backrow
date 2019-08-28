import * as types from '../constants/ActionTypes';

const initialState = {
  list: [],
  addMedia: false,
  colorPicker: false,
  guestAuth: false,
  imagePicker: false,
  logForm: false,
  newRoom: false,
  playlist: false,
  profileSettings: false,
};

const Popups = (state = initialState, action) => {
  switch (action.type) {
    case types.ADD_POPUP: {
      // const tempList = [...state.list, action.payload];
      // const list = tempList.filter(
      //   (obj, index, arr) => arr.map(popup => popup.id).indexOf(obj.id) === index
      // );

      return { ...state, [action.payload]: true };
    }

    case types.REMOVE_POPUP: {
      // const filtered = state.list.filter(el => el.id !== action.payload);
      return { ...state, [action.payload]: false };
    }

    case types.TOGGLE_POPUP: {
      const currentElement = action.payload;
      let { list } = state;
      const shouldRemove = list.find(el => currentElement.id === el.id);
      if (shouldRemove) list = list.filter(el => el.id !== currentElement.id);
      else list = [...list, currentElement];
      return { list };
    }

    case types.CLEAR_POPUPS: {
      return { list: [] };
    }

    default:
      return state;
  }
};

export default Popups;
