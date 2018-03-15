import engine = require('engine.io-client');

import { Coordinator } from '../coordinator/coordinator';
import { NetworkProvider } from '../network/provider';
import { Query } from '../query/query';
import { FactChannel } from './factChannel';

import Socket = engine.Socket;
export class JinagaDistributor implements NetworkProvider {
    socket: Socket;
    coordinator: Coordinator;
    isOpen: boolean = false;
    channel: FactChannel;
    pending: Array<string> = [];
    watches: Array<string> = [];

    private maxTimeout: number = 1 * 1000;
    private log: (id: number, fact: any) => void;

    constructor(
        private endpoint: string
    ) {
        this.createSocket();
    }

    public init(coordinator: Coordinator) {
        this.coordinator = coordinator;
    }

    public capture(log: (id: number, fact: any) => void) {
        this.log = log;
    }

    public watch(start: Object, query: Query, token: number) {
        var watch = {
            type: "watch",
            start: start,
            query: query.toDescriptiveString(),
            token: token
        };
        this.watches.push(JSON.stringify(watch));
        this.send(JSON.stringify(watch));
    }

    public stopWatch(start: Object, query: Query) {
        var descriptiveString = query.toDescriptiveString();
        var watch = {
            type: "watch",
            start: start,
            query: descriptiveString
        };
        var index = this.watches.indexOf(JSON.stringify(watch));
        if (index >= 0) {
            this.watches.splice(index, 1);
            this.send(JSON.stringify({
                type: "stop",
                start: start,
                query: descriptiveString
            }));
        }
    }

    public query(start: Object, query: Query, token: number) {
        this.send(JSON.stringify({
            type: "query",
            start: start,
            query: query.toDescriptiveString(),
            token: token
        }));
    }

    public fact(fact: Object) {
        this.channel.sendFact(fact);
    }

    private createSocket() {
        this.channel = new FactChannel(1,
            message => this.send(JSON.stringify(message)),
            fact => this.coordinator.onReceived(fact, null, this));
        this.socket = new Socket(this.endpoint);
        this.socket.on("open", () => { this.onOpen(); });
        this.socket.on("error", error => { this.onError(error.message); });
    }

    private send(message: string) {
        if (this.isOpen)
            this.socket.send(message);
        else
            this.pending.push(message);
    }

    private onOpen() {
        this.coordinator.onError(null);
        
        this.socket.on("message", (message) => { this.onMessage(message); });
        this.socket.on("close", () => { this.onClose(); });

        this.maxTimeout = 1 * 1000;

        this.isOpen = true;
        this.pending.forEach((message: string) => {
            this.socket.send(message);
        });
        this.pending = [];
    }

    private onError(error) {
        this.coordinator.onError(error);
        this.retry();
    }

    private onMessage(message) {
        var messageObj = JSON.parse(message);
        if (messageObj.type === "fact") {
            if (this.log) {
                this.log(messageObj.id, messageObj.fact);
            }
            this.channel.messageReceived(messageObj);
        }
        if (messageObj.type === "received") {
            this.coordinator.onDelivered(messageObj.token, this);
        }
        if (messageObj.type === "loggedIn") {
            this.coordinator.onLoggedIn(messageObj.userFact, messageObj.profile);
        }
        if (messageObj.type === "done") {
            this.coordinator.onDone(messageObj.token);
        }
    }

    private onClose() {
        this.isOpen = false;
        this.retry();
    }

    private retry() {
        setTimeout(() => { this.resendMessages(); }, Math.random() * this.maxTimeout);
        this.maxTimeout *= 2;
        if (this.maxTimeout > 30 * 1000)
            this.maxTimeout = 30 * 1000;
    }

    private resendMessages() {
        this.createSocket();
        if (this.pending.length === 0)
            this.coordinator.resendMessages();
        this.watches.forEach(w => {
            this.socket.send(w);
        });
    }
}