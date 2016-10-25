'use strict';

import express = require('express');
import fs = require('fs');
//import Q = require('q');
//import path = require('path');
//import cfg = require('./config');
//import jsonwt = require('jsonwebtoken');
import jwt = require('./jwtManage');
import base = require('./base');
import da = require('./dal');
import path = require('path');
import mime = require('mime');

interface IFileData {
    name: string;
    userId: string;
    link: string;
}

export class FileData implements IFileData {
    public name: string;
    public userId: string;
    public link: string;

    constructor(fd: IFileData) {
        this.name = fd.name;
        this.userId = fd.userId;
        this.link = fd.link;
    }
}

export class FileHandler extends base.Base {
    gitCloneRootFolder: string = 'C:\\GitRepos\\';

    constructor(da: da.DataAccess) {
        super();
        this.dataAccess = da;
    }

    // get all the file infos.
    getFiles = (): express.RequestHandler => {
        var em = this.sendErrorMessage;
        var self = this;
        return (req: express.Request, res: express.Response) => {
            try {
                //console.warn('The query is ****************** :' + JSON.stringify(req.query));
                jwt.JwtManager.verifyToken(req.query.token, (err: any) => {
                    if (!err) {
                        var userId: string = req.query.userId;
                        var fileName: string = req.query.fileName;
                        if (userId) {
                            var fullPath: string = path.join(this.gitCloneRootFolder, userId);

                            if (fileName) {
                                self.sendFileWithMime(res, fullPath, fileName, em);
                            }
                        }
                    } else {
                        return res.status(401).json('Failed to authenticate token.');
                    }
                });
            } catch (ex) {
                console.warn('Unexpected Error while getting the file' + ex);
                self.sendExceptionMessage(res, 'Unexpected Error while getting the file', ex);
            }
        };
    }

    sendFileWithMime = (res: express.Response, fullPath: string, fileName: string, em: Function) => {
        var filePath: string = path.join(fullPath, fileName);
        var mimetype = mime.lookup(filePath);
        //console.warn('The full file path is ****************** :' + filePath);

        res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
        res.setHeader('Content-type', mimetype);

        var filestream = fs.createReadStream(filePath);
        filestream.pipe(res);
    }
}
