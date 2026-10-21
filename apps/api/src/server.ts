import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp(config);

app.listen(config.PORT, () => {
  console.log(`StudyVerse API listening on http://localhost:${config.PORT}/api/v1`);
});
