//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
import mongo = require('mongodb');
import assert = require('assert');
import Q = require('q');
import um = require('./userManager');

export class DataAccess {
    static mongoUrl: string = 'mongodb://admin:G6u2Z9yY8hDe@127.0.0.1:27017'; //'mongodb://127.0.0.1:27017/SDLAnalysisDB';
    dbConnection: mongo.Db = null;
    public openDbConnection() {
        var deferred = Q.defer<mongo.Db>();

        if (this.dbConnection == null) {
            mongo.MongoClient.connect(DataAccess.mongoUrl, (err: mongo.MongoError, db: mongo.Db) => {
                assert.equal(null, err);
                console.warn('Connected correctly to MongoDB server.');
                this.dbConnection = db;
                deferred.resolve(this.dbConnection);
            });
        } else {
            deferred.resolve(this.dbConnection);
        }

        return deferred.promise;
    }

    public closeDbConnection() {
        if (this.dbConnection) {
            this.dbConnection.close();
            this.dbConnection = null;
        }
    }

    public getUsersCount(): any {
        return this.getDocumentCount('Users');
    }

    public getUser(user: um.UserData): any {
        var deferred = Q.defer();

        if (this.dbConnection) {
            console.warn('Inside getUser : domain - ' + user.domainName + ' user - ' + user.userName);
            var collection: mongo.Collection = this.dbConnection.collection('Users');

            if (!collection) {
                deferred.reject(new Error('Users DB collection don\'t exist'));
            }

            //collection.findOne({ DomainName: user.DomainName, UserName: user.UserName },
            //    function (err: mongo.MongoError, doc: ntlm.UserData) {
            //    console.warn(doc);
            //});

            collection.findOne({ domainName: user.domainName, userName: user.userName },
                (err: mongo.MongoError, doc: um.UserData) => {
                    if (err) {
                        deferred.reject(new Error(JSON.stringify(err)));
                    } else if (doc !== null &&
                        doc.domainName === user.domainName &&
                        doc.userName === user.userName) {
                        return deferred.resolve(doc);
                    } else if (doc === null) {
                        return deferred.resolve(doc);
                    }
                });
        }

        return deferred.promise;
    }

    public insertUser(user: um.UserData, id: number): any {
        return this.insertDocument(user, 'Users');
    }

    /*
        private editDocument(document: any, collectionName: string): any {
            var deferred = Q.defer();
            this.dbConnection.collection(collectionName).updateOne({ 'id': document.id }, { $set: document }, (err, result) => {
                assert.equal(err, null);
                if (err) {
                    deferred.reject(new Error(JSON.stringify(err)));
                }
                deferred.resolve(result);
            });
            return deferred.promise;
        };
    */
    private insertDocument(doc: Object, collectionName: string): any {
        var deferred = Q.defer();
        this.dbConnection.collection(collectionName).insertOne(doc, (err: mongo.MongoError, result: any) => {
            assert.equal(err, null);
            if (err) {
                deferred.reject(new Error(JSON.stringify(err)));
            }
            deferred.resolve(result);
        });

        return deferred.promise;
    }

    private getDocumentCount(collectionName: string): any {
        var deferred = Q.defer();
        if (this.dbConnection) {
            this.dbConnection.collection(collectionName).count((err: mongo.MongoError, result: number) => {
                assert.equal(err, null);
                if (err) {
                    deferred.reject(new Error(JSON.stringify(err)));
                }
                deferred.resolve(result);
            });
        }
        return deferred.promise;
    }

}
