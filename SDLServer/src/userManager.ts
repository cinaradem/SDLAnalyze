'use strict';

import spawn = require('child_process');
import Q = require('q');
import ut = require('./utils');
var utils = ut.Utils;

export interface UserData {
    id: string;
    userName: string,
    displayName: string,
    domainName: string
}

export class UserManager {
    createUser = (domainUser: string): Q.Promise<UserData> => {
        var deferred = Q.defer<UserData>();
        return deferred.promise;
    }

    getUserDisplayName = (domainUser : string): Q.Promise<string> => {
        var deferred = Q.defer<string>();

        var options = [domainUser];
        var out = '';
        const cmd = spawn.spawn('C:\\Web\\UserProfile.exe', options);

        cmd.stdout.on('data', (data: string) => {
            out += data;
            out = utils.splitByCRLF(out)[0];
        });

        cmd.stderr.on('data', (data: string) => {
            console.warn('Error reported ' + data);
            deferred.reject('Error reported ' + data);
        });

        cmd.on('close', (code: number) => {
            console.warn('child process exited with code ' + code);
            deferred.resolve(out);
        });

        return deferred.promise;
    }
}
