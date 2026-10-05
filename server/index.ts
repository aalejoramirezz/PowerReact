import dotenv from 'dotenv';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

dotenv.config();

const config = loadConfig();

createApp(config).listen(config.port, () => {
  console.log(`PowerReact API Server running on port ${config.port}`);
});
