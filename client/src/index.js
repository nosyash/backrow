import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import '../../node_modules/bootstrap/dist/css/bootstrap.css';
// import 'font-awesome/css/font-awesome.min.css';
// import fontawesome from '@fortawesome/fontawesome-free';
import '@fortawesome/fontawesome-free/css/all.min.css';
// import regular from '@fortawesome/free-regular-svg-icons';
// import solid from '@fortawesome/free-solid-svg-icons';
// import brands from '@fortawesome/free-brands-svg-icons';
// import reducer from './reducers/MainStates';
import reducer from './reducers/Base';

import './css-autogenerated/main.css';
import * as serviceWorker from './serviceWorker';
import App from './Components/App';

// fontawesome.library.add(regular);
// fontawesome.library.add(solid);
// fontawesome.library.add(brands);

let tempStore;
if (process.env.NODE_ENV === 'development') {
  tempStore = createStore(
    reducer,
    window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
  );
} else {
  tempStore = createStore(reducer);
}

export const store = tempStore;
ReactDOM.render(
  <Provider store={store}>
    <React.Fragment>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.Fragment>
  </Provider>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
