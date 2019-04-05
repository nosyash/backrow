import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as types from '../../../constants/ActionTypes';

class SubtitlesContainer extends Component {
  componentDidMount() {
    this.formatSubs();
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  toStr = s => JSON.stringify(s);

  timer = null;

  shouldComponentUpdate(nextProps, nextState) {
    const { subs } = this.props;
    const a = this.toStr(nextProps.subs.text);
    const b = this.toStr(subs.text);
    if (a !== b) return true;
    return false;
  }

  formatSubs = () => {
    const { subs, videoEl } = this.props;
    const { UpdateSubs } = this.props;

    if (!subs.srt) return (this.timer = setTimeout(this.formatSubs, 80));

    const { currentTime } = videoEl;
    const ms = currentTime * 1000 + 100;
    const currentText = this.toStr(subs.text);

    const text = subs.srt.filter(s => s.start <= ms && ms <= s.end).reverse();

    if (this.toStr(text) === '') {
      if (currentText !== []) UpdateSubs({ text: [] });
      return (this.timer = setTimeout(this.formatSubs, 80));
    }

    text.forEach(el => {
      el.text = el.text.replace(/\n/gm, ' ').replace(/^<.*>(.*)<\/.*>$/, '$1');
    });

    if (currentText !== this.toStr(text)) UpdateSubs({ text });

    this.timer = setTimeout(this.formatSubs, 80);
  };

  render() {
    const { subs } = this.props;
    const { text } = subs;
    if (!text) return null;
    return <RenderSubs text={text} />;
  }
}

const RenderSubs = ({ text }) => (
  <div className={`subs-container${text.length > 3 ? ' subs-container_minified' : ''}`}>
    {text.map((el, i) => (
      <div key={i} className="sub-line">
        {el.text}
      </div>
    ))}
  </div>
);

const mapStateToProps = state => ({
  media: state.Media,
  subs: state.Media.subs,
});

const mapDispatchToProps = {
  UpdateSubs: payload => ({ type: types.UPDATE_SUBS, payload }),
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SubtitlesContainer);
