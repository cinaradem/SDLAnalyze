//
// base
// 
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
import express = require('express');
import da = require('./dal');

export class Base {
    dataAccess: da.DataAccess;
    socket: any;

    sendExceptionMessage = (res: express.Response, message : string, ex : any) => {
        res.status(400).json({
            Message: message,
            ExceptionMessage: ex
        });
    }

    sendErrorMessage = (res: express.Response, e?: Error) => {
        if (e) {
            var ex = JSON.stringify(e);
            return res.status(400).json({ Message: e.message, ExceptionMessage: ex });
        } else {
            res.sendStatus(400);
        }
    }

    sendSocketMessage = (messageId: string, messageBody: any) => {
        console.warn('Send socket message');
        if (this.socket) {
            this.socket.emit(messageId, messageBody);
        }
    }

    public setSocket = (socket: any) => {
        console.warn('setting the socket - socket is not valid : ' + (socket === undefined || socket === null));
        this.socket = socket;
    }
}
