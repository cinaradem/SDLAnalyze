'use strict';
import fs = require('fs');
export interface ConfigData {
    user: string,
    token: string
}
export class Config {
    static data: ConfigData = JSON.parse(fs.readFileSync('config.json', 'UTF-8'));
}
