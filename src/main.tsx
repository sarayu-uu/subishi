import { render } from 'preact';
import { App } from './App';
import { startAnalytics } from './analytics';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-600.css';
import './styles/fonts.css';
import './styles/tokens.css';

render(<App />, document.getElementById('app')!);
startAnalytics();
