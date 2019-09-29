import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import * as types from '../../../../../constants/actionTypes';
import SubtitlesHandler from '../../../../../utils/subtitles';
import { Subtitles, Media, SubtitlesItem } from '../../../../../reducers/media';


interface SubtitilesProps {
    media: Media;
    subs: Subtitles;
    showSubs: boolean;
    videoEl: HTMLVideoElement;
    updateSubs: (payload: any) => void;
    setCurrentSubs: (payload: any) => void;
}

let timer = null;
let pauseTimer = null;
const subtitlesHandler = new SubtitlesHandler();

function SubtitlesContainer(props: SubtitilesProps) {
    const videoEl = React.useRef() as any;
    useEffect(() => {
        initSubs(formatSubs);

        return () => {
            clearTimeout(timer);
        };
    }, []);

    function initSubs(callback: () => void) {
        const { subs } = props;
        if (!subs.parsed) return;
        videoEl.current = document.querySelector('.player-inner video');
        subtitlesHandler.setSubtitles(subs.parsed);
        callback();
    }

    function formatSubs() {
        const { subs, showSubs } = props;
        const { setCurrentSubs } = props;

        if (!showSubs) return;
        if (!videoEl.current) return;

        const currentText = subs.raw;
        const timeMs = videoEl.current.currentTime * 1000;
        if (videoEl.paused) {
            pauseTimer = setTimeout(() => {
                subtitlesHandler.setCurrentTime(timeMs);
                subtitlesHandler.updateSubsChunk();
            }, 20);
            clearTimeout(pauseTimer);
        }

        const newText = subtitlesHandler.getSubtitles(timeMs);
        if (JSON.stringify(currentText) !== JSON.stringify(newText)) {
            setCurrentSubs(newText);
        }
        timer = setTimeout(formatSubs, 64);
    }

    const { raw } = props.subs;
    return <RenderSubs text={raw} />;
}

// eslint-disable-next-line react/display-name
const RenderSubs = React.memo(({ text }: { text: SubtitlesItem[] }) => {
    return <RenderSub text={text} />;
});

const RenderSub = ({ text }: { text: SubtitlesItem[] }) => {
    const minify = text.length > 3;
    const classes = `subs-container${minify ? ' subs-container_minified' : ''}`;
    return (
        <div className={classes}>
            {text.map(currentSub => (
                <div
                    key={currentSub.text + currentSub.end + currentSub.start}
                    className="sub-line"
                >
                    {currentSub.text}
                </div>
            ))}
        </div>
    );
};

const mapStateToProps = state => ({
    media: state.media,
    showSubs: state.media.showSubs,
    subs: state.media.subs,
});

const mapDispatchToProps = {
    updateSubs: (payload: any) => ({ type: types.SET_SUBS, payload }),
    setCurrentSubs: (payload: any) => ({ type: types.SET_CURRENT_SUBS, payload }),
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SubtitlesContainer);
