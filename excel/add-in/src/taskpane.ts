import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';
import './styles.css';

Office.onReady(() => {
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );
});
