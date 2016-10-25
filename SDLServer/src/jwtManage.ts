//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//

'use strict';
import fs = require('fs');
import jwt = require('jsonwebtoken');
import Q = require('q');

class UnauthorizedError {
    name: string = 'UnauthorizedError';
    message: string;
    code: any;
    status: number = 401;
    inner: Error;

    constructor(code: any, error: Error) {
        Error.call(this, error.message);
        Error.captureStackTrace(this, this.constructor);
        this.message = error.message;
        this.code = code;
        this.inner = error;
    }
}

UnauthorizedError.prototype = Object.create(Error.prototype);
UnauthorizedError.prototype.constructor = UnauthorizedError;

export class JwtManager {
    private static token: string;
    static publicKey: string = JSON.stringify({ 'key': fs.readFileSync('key.pub', 'UTF8'), 'now': Date.now() });
    static authorization: string = undefined;

    public static getToken = (user?: any): string => {
        if (user !== undefined) {
            JwtManager.token = jwt.sign(user, JwtManager.publicKey);
        }

        return JwtManager.token;
    };

    public static extractToken = (req: any): string => {
        console.warn('Inside extractToken - headres : ' + JSON.stringify(req.headers));
        var token;
        if (req.headers && req.headers['x-auth-token']) {
            var parts = req.headers['x-auth-token'].split(' ');
            if (parts.length === 2) {
                var scheme = parts[0];
                var credentials = parts[1];

                if (/^Bearer$/i.test(scheme)) {
                    token = credentials;
                } else {
                    throw (new UnauthorizedError('credentials_bad_scheme',
                        { name: 'UnauthorizedError', message: 'Format is x-auth-token: Bearer [token]' }));
                }
            } else {
                throw (new UnauthorizedError('credentials_bad_scheme',
                    { name: 'UnauthorizedError', message: 'Format is x-auth-token: Bearer [token]' }));
            }
        }

        return token;
    }

    public static verifyToken = (token: string, fn: Function): any => {
        try {
            jwt.verify(token, JwtManager.publicKey, (err: jwt.JsonWebTokenError |
                jwt.TokenExpiredError | jwt.NotBeforeError, decoded: any) => {
                if (err) {
                    fn(err);
                } else {
 //                   console.warn('jwt decoded :' + JSON.stringify(decoded));
                    fn(null);
                }
            });
        } catch (ex) {
            fn(ex);
        }
    }

    public static authenticate = (headers: any): Q.Promise<any> => {
        var deferred = Q.defer();
        console.warn('Inside authenticate');
        //var token = headers.authorization; //['authorization'];
        var token = headers['x-auth-token'];
        if (token && /^Bearer$/i.test(token.split(' ')[0])) {
            token = token.split(' ')[1];

            jwt.verify(token, JwtManager.publicKey, (err: jwt.JsonWebTokenError |
                jwt.TokenExpiredError | jwt.NotBeforeError, decoded: any) => {
                if (err) {
                    deferred.reject(new Error('Failed to authenticate token.'));
                } else {
                    deferred.resolve(decoded);
                }
            });
        } else {
            deferred.reject(new Error('Authenticate token not present'));
        }

        return deferred.promise;
    }
}
