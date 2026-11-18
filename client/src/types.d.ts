declare module '*.css';

/** Injected by webpack's DefinePlugin (see webpack.config.js). */
declare const __SENTRY_DSN__: string;
declare const __APP_ENV__: 'development' | 'production';
