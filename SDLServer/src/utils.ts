'use strict';

import Q = require('q');
import fs = require('fs');

export class Utils {
    static re: RegExp = new RegExp('C:\\\\GitRepos\\\\', 'gi');

    static resolveIfAll = (ps: Array<any>, deferred: Q.Deferred<{}>): void => {
        Q.all(ps).then(() => {
            deferred.resolve();
        });
    }

    static strStartsWith = (search: string, str: string): boolean => {
        return search.substr(0, str.length) === str;
    }

    static trimExcess = (x: string): string => {
        return x.replace(/^[\"\s]+|[\"\s]+$/gm, '');
    }

    static splitByCRLF = (message: string): Array<string> => {
        let splits = [];
        var m = '';
        message.split('').map((c: any) => {
            if (c === '\r') {
                splits.push(Utils.replace(m));
                m = '';
                return;
            };
            if (c !== '\n') {
                m += c;
            }
        });
        return splits;
    }

    static replace = (data: string): string => {
        //if (data.indexOf(': warning  :') !== -1 || data.indexOf(': error  :') !== -1) {
        //    data = data.replace(Utils.re, '');
        //}
        data = data.replace(Utils.re, '');
        return data;
    }

    /*
     * Write a file with the data.
     */
    static writeFile = (fileName: string, data: string): void => {
        fs.writeFileSync(fileName, data, {
            encoding: 'UTF8',
        });
    }
}
