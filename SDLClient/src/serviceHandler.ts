//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
'use strict';

interface IServiceHandler {
    assign(service: ExportService): void;
}

export class ExportService {
    $http: any;
    cacheFactory: angular.ICacheFactoryService;
    constructor($http: angular.IHttpService, $cacheFactory: angular.ICacheFactoryService) {
        this.cacheFactory = $cacheFactory;
        this.$http = $http;
        return this;
    }
}

export class ServiceHandler implements IServiceHandler {
    service: ExportService;
    cache: angular.ICacheObject = null;

    public assign(service: ExportService): void {
        this.service = service;
    }

    public setToken(token: string): void {
        if (!this.cache) {
            this.cache = this.service.cacheFactory('SDLClient');
        }

        if (angular.isUndefined(this.cache.get('token'))) {
            this.cache.put('token', angular.isUndefined(token) ? null : token);
     //       this.service.$http.defaults.headers.common.Authorization = 'Bearer ' + token;
            this.service.$http.defaults.headers.common['x-auth-token'] = 'Bearer ' + token;
        }
    }

    public getUser<T>(): angular.IHttpPromise<T> {
        return this.service.$http({
            method: 'GET',
            url: '/sdlserver'
        });
    };

    public analyzeSolution<T>(slnPath: string): angular.IHttpPromise<T> {
        return this.service.$http({
            method: 'GET',
            url: '/sdlserver/api/Analyze?solnPath=' + slnPath
        });
    };

    public cloneRepository<T>(url: string): angular.IHttpPromise<T> {
        return this.service.$http({
            method: 'GET',
            url: '/sdlserver/api/CloneGitRepo?gitRepoUrl=' + url,
            timeout: 3600000 //60 minutes.
 //           withCredentials: false
        });
    };

    public buildSolution<T>(slnPath: string): angular.IHttpPromise<T> {
        return this.service.$http({
            method: 'GET',
            url: '/sdlserver/api/BuildSolution?solnPath=' + slnPath
        });
    };
}