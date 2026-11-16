/// <reference types="node" />
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// jsdom lacks these; react-router needs them.
Object.assign(globalThis, { TextEncoder, TextDecoder });
