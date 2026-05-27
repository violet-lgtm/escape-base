import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Editor } from './editor/Editor.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// ?edit opens the visual editor; otherwise the player runs.
const editing = new URLSearchParams(window.location.search).has('edit');

createRoot(root).render(<StrictMode>{editing ? <Editor /> : <App />}</StrictMode>);
