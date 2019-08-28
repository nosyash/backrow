import React, { useRef, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { throttle } from 'lodash';
import { getCenteredRect } from '../../../utils/base';
import * as types from '../../../constants/ActionTypes';
import { POPUP_HEADER } from '../../../constants';
import ProfileSettings from './ProfileSettings';

function Popups({ popups, removePopup, id }) {
  const handleResizeTh = throttle(handleResize, 16);
  useEffect(() => {
    addEvents();

    return () => {
      removeEvents();
    };
  }, []);

  function addEvents() {
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResizeTh);
  }

  function removeEvents() {
    document.removeEventListener('keydown', handleKey);
    window.removeEventListener('resize', handleResizeTh);
  }

  function handleResize() {}

  function handleKey(e) {
    const { keyCode } = e;
    const lastPopup = popups[popups.length - 1];
    if (keyCode !== 27) return;
    if (lastPopup) {
      if (lastPopup.id === 'profile-settings') return;
      removePopup(lastPopup.id);
    }
  }

  return (
    <div className="popups_container">
      {popups.profileSettings &&
        renderSinglePopup(<ProfileSettings />, 'profileSettings')}
      {/* {popups.map(popup => renderSinglePopup(popup))} */}
    </div>
  );

  function renderSinglePopup(popup, name) {
    return <Popup removePopup={() => removePopup(name)} popupElement={popup} />;
  }
}

let clientX = null;
let clientY = null;

function Popup(props) {
  const [width, setWidth] = useState(0);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const [moving, setMoving] = useState(false);
  const [show, setShow] = useState(false);
  const popupEl = useRef(null);

  useEffect(() => {
    const { width: w, height: h } = popupEl.current.getBoundingClientRect();
    setStates({ ...getCenteredRect(w, h) });
    setShow(true);
  }, []);

  useEffect(() => {
    // const { popupElement } = props;

    removeEvents();
    addEvents();
    return () => {
      removeEvents();
    };
  }, [width, top, left, moving]);

  function setStates(states) {
    if (states.width) setWidth(states.width);
    if (states.top) setTop(states.top);
    if (states.left) setLeft(states.left);
    if (states.moving) setMoving(states.moving);
  }

  function addEvents() {
    popupEl.current.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function removeEvents() {
    popupEl.current.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  function handleMouseDown(e) {
    if (moving) return;
    const { left: left_, top: top_ } = popupEl.current.getBoundingClientRect();
    const { target, clientX: clientX_, clientY: clientY_ } = e;
    clientX = clientX_ - left_;
    clientY = clientY_ - top_;
    if (target.matches(POPUP_HEADER)) {
      setMoving(true);
    }
  }

  function handleMouseMove(e) {
    if (!moving) return;

    const { clientX: clientX_, clientY: clientY_ } = e;

    const { left: left_, top: top_ } = popupEl.current.getBoundingClientRect();
    const offsetX = left_ + (clientX_ - (left_ + clientX));
    const offsetY = top_ + (clientY_ - (top_ + clientY));
    setStates({ left: offsetX, top: offsetY });
  }

  function handleMouseUp() {
    if (moving) {
      setMoving(false);
    }
  }

  const { removePopup, popupElement } = props;
  const visibility = show ? 'visible' : 'hidden';
  return (
    <div
      ref={popupEl}
      style={{
        width: width || 'auto',
        top: top || 'auto',
        left: left || 'auto',
        visibility,
      }}
      className="popup"
    >
      <div data-id={0} className="popup-header">
        <div className="header-controls controls-container">
          <span onClick={() => removePopup()} className="control">
            <i className="fas fa-times" />
          </span>
        </div>
      </div>
      {popupElement}
    </div>
  );
}

const mapStateToProps = state => ({
  popups: state.Popups,
});

const mapDispatchToProps = {
  removePopup: payload => ({ type: types.REMOVE_POPUP, payload }),
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Popups);
