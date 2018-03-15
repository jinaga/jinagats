import Keypair = require('keypair');
import MongoDb = require('mongodb');

import { Coordinator } from '../coordinator/coordinator';
import { KeystoreProvider } from '../keystore/provider';
import { UserIdentity } from '../keystore/user-identity';
import { PersistenceProvider } from '../persistence/provider';
import { Query } from '../query/query';
import { computeHash } from '../utility/fact';
import { executeIfMatches, pipelineProcessor, Point } from './graph';
import { Pool } from './pool';
import { saveFact } from './save';

var MongoClient = MongoDb.MongoClient;

class MongoConnection {
    constructor(
        public db: any,
        public collection: any
    ) { }
}

export class MongoProvider implements PersistenceProvider, KeystoreProvider {
    private coordinator: Coordinator;
    private count: number = 0;
    private pools: { [collectionName: string]: Pool<MongoConnection> } = {};
    private quiet: () => void;
    
    public constructor(
        public url: string
    ) { }

    public init(coordinator: Coordinator) {
        this.coordinator = coordinator;
        this.withCollection('successors', (collection, done) => {
            collection.createIndex({
                'hash': 1,
                'predecessors': 1
            }, {
                unique: true
            }, function (err) {
                if (err) {
                    coordinator.onError(err);
                }
                collection.createIndex({
                    'predecessors.role': 1,
                    'predecessors.hash': 1,
                    'fact.type': 1
                }, function (err) {
                    if (err) {
                        coordinator.onError(err);
                    }
                    collection.createIndex({
                        'hash': 1
                    }, function (err) {
                        if (err) {
                            coordinator.onError(err);
                        }
                        collection.createIndex({
                            'predecessors.hash': 1
                        }, function (err) {
                            if (err) {
                                coordinator.onError(err);
                            }
                            done();
                        });
                    });
                });
            });
        })
    }
    
    public save(fact: Object, source: any) {
        this.withCollection("successors", (collection, done) => {
            saveFact(collection, fact, (error, saved) => {
                if (error) {
                    this.coordinator.onError(error);
                }
                else {
                    saved.forEach(f => {
                        this.coordinator.onSaved(f, source);
                    });
                }
                done();
            });
        });
    }
    
    public executePartialQuery(
        start: Object,
        query: Query,
        result: (error: string, facts: Array<Object>) => void
    ) {
        executeIfMatches(start, query.steps, (facts) => result(null, facts), (start, steps) => {
            this.withCollection("successors", (collection, done) => {
                const processor = pipelineProcessor(collection, steps);
                processor(new Point(start, computeHash(start)), (error, facts) => {
                    if (error)
                        result(error, []);
                    else
                        result(null, facts
                            .map(f => f.fact));
                    done();
                });
            });
        });
    }
    
    public getUserFact(userIdentity: UserIdentity, done: (userFact: Object) => void) {
        if (!userIdentity) {
            done(null);
        }
        else {
            this.withCollection("users", (users, close: () => void) => {
                var publicKey = null;
                users.find({
                    provider: userIdentity.provider,
                    userId: userIdentity.id
                }).forEach((userDocument: any) => {
                    publicKey = userDocument.publicKey;
                }, (error: any) => {
                    if (error) {
                        this.coordinator.onError(error);
                        done(null);
                        close();
                    }
                    else {
                        if (publicKey) {
                            done({
                                type: "Jinaga.User",
                                publicKey: publicKey
                            });
                            close();
                        }
                        else {
                            var pair = Keypair({ bits: 1024 });
                            var privateKey = pair.private;
                            publicKey = pair.public;
                            users.insertOne({
                                provider: userIdentity.provider,
                                userId: userIdentity.id,
                                privateKey: privateKey,
                                publicKey: publicKey
                            }, (error, result) => {
                                if (error) {
                                    this.coordinator.onError(error.message);
                                    done(null);
                                    close();
                                }
                                else {
                                    done({
                                        type: "Jinaga.User",
                                        publicKey: publicKey
                                    });
                                    close();
                                }
                            });
                        }
                    }
                });
            });
        }
    }
    
    ///////////////////////////
    
    public whenQuiet(quiet: () => void) {
        if (this.count === 0) {
            quiet();
        }
        else {
            var prior = this.quiet;
            this.quiet = () => {
                if (prior) {
                    prior();
                    this.whenQuiet(quiet);
                }
                else
                    quiet();
            }
        }
    }
    
    ///////////////////////////

    private withCollection(collectionName:string, action:(collection:any, done:()=>void)=>void) {
        this.count++;
        if (!this.pools[collectionName]) {
            this.pools[collectionName] = new Pool<MongoConnection>(
                (done: (connection: MongoConnection) => void) => {
                    MongoClient.connect(this.url, (err, db) => {
                        if (err) {
                            this.coordinator.onError(err.message);
                            done(null);
                        }
                        else {
                            done(new MongoConnection(db, db.collection(collectionName)));
                        }
                    });
                },
                (connection: MongoConnection) => {
                    connection.db.close();
                }
            );
        }
        this.pools[collectionName].begin((connection: MongoConnection, done: () => void) => {
            action(connection.collection, () => {
                done();
                this.count--;
                if (this.count === 0 && this.quiet) {
                    var quiet = this.quiet;
                    this.quiet = null;
                    quiet();
                }
            });
        });
    }
}
