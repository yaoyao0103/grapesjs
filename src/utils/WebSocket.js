import Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import ComponentDelete from '../commands/view/ComponentDelete';
import { myEditor } from '../index.js';
import CircularJSON from 'circular-json';
import OpenBlocks from '../commands/view/OpenBlocks';

export var stompClient;
var localTS = 0;
var username = '';
var sessionId = '';
export var ClientState = ClientStateEnums.Synced;
export const ClientStateEnum = {
  Synced: 1,
  AwaitingACK: 2,
  AwaitingWithBuffer: 3,
  ApplyingRemoteOp: 4,
  ApplyingLocalOp: 5,
  ApplyingRemoteOpWithoutACK: 6,
  ApplyingBufferedLocalOp: 7,
  CreatingLocalOpFromBuffer: 8,
  ApplyingRemoteOpWithBuffer: 9,
  SendingOpToController: 10,
};
var remoteOp;
var remoteTS;
var localOpPrime;
var remoteOpPrime;
var opBuffer = new Array();

export const connectWebSocket = () => {
  username = makeId(5);
  let socket = new SockJS('http://localhost:8081/websocket');
  stompClient = Stomp.over(socket);
  stompClient.connect({}, onConnected, onError);
};

const onConnected = () => {
  // Subscribe to the Public Topic
  stompClient.subscribe('/topic/public', onMessageReceived);
  //console.log("session id: ", sessionId);
  stompClient.subscribe('/user/' + username + '/msg', onMessageReceived);

  // Tell your username to the server
  stompClient.send('/app/chat.register', {}, JSON.stringify({ sender: username, type: 'JOIN' }));
};

const makeId = length => {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const onError = () => {
  console.log('Error!!');
};

const onMessageReceived = async payload => {
  let StoC_msg = CircularJSON.parse(payload.body);
  //let remoteOp = CircularJSON.parse(StoC_msg.op);
  if (StoC_msg.type === 'JOIN') {
    // self
    if (StoC_msg.sender === username) {
      sessionId = StoC_msg.sessionId;
      //stompClient.subscribe('/user/' + sessionId + '/msg', onMessageReceived);
    }
    // other client
    else {
      // todo: push op to buffer
      /*
            initBuffer.push(remoteOp);
            */
    }
  } else if (StoC_msg.type === 'FINISH-JOIN') {
    /*
        initBuffer.foreach(remoteOp => {
            applyRemoteOp(remoteOp.action, remoteOp.opts);
        });
        */
  } else if (StoC_msg.type === 'LEAVE') {
  } else if (StoC_msg.type === 'ACK') {
    //-------------------------- State: AwaitingACK ------------------------------
    if (ClientState == ClientStateEnum.AwaitingACK) {
      ClientState = ClientStateEnum.Synced;
      console.log('state: Synced');
    }
    //-------------------------- State: AwaitingWithBuffer ------------------------------
    else if (ClientState == ClientStateEnum.AwaitingWithBuffer) {
      /***** CreatingLocalOpFromBuffer *****/
      ClientState = ClientStateEnum.CreatingLocalOpFromBuffer;
      console.log('state: CreatingLocalOpFromBuffer');
      await CreatingLocalOpFromBuffer();
    }
    //-------------------------- State: Others ------------------------------
    else {
      if (ClientState != ClientStateEnum.AwaitingACK && ClientState != ClientStateEnum.AwaitingWithBuffer) {
        onMessageReceived(payload);
      }
    }
  } else if (StoC_msg.type === 'OP') {
    //--------------------------- State: Synced -----------------------------
    if (ClientState == ClientStateEnum.Synced) {
      /***** ApplyRemoteOp *****/
      ClientState = ClientStateEnum.ApplyingRemoteOp;
      console.log('state: ApplyingRemoteOp');
      await ApplyingRemoteOp(StoC_msg);
    }
    //-------------------------- State: AwaitingACK ------------------------------
    else if (ClientState == ClientStateEnum.AwaitingACK) {
      /***** ApplyingRemoteOpWithoutACK *****/
      ClientState = ClientStateEnum.ApplyingRemoteOpWithoutACK;
      console.log('state: ApplyingRemoteOpWithoutACK');
      await ApplyingRemoteOpWithoutACK(StoC_msg);
    }
    //-------------------------- State: AwaitingWithBuffer ------------------------------
    else if (ClientState == ClientStateEnum.AwaitingWithBuffer) {
      /***** ApplyingRemoteOpWithBuffer *****/
      ClientState = ClientStateEnum.ApplyingRemoteOpWithBuffer;
      console.log('state: ApplyingRemoteOpWithBuffer');
      await ApplyingRemoteOpWithBuffer(StoC_msg);
    }
    //-------------------------- State: Others ------------------------------
    else {
      if (
        ClientState != ClientStateEnum.Synced &&
        ClientState != ClientStateEnum.AwaitingACK &&
        ClientState != ClientStateEnum.AwaitingWithBuffer
      ) {
        onMessageReceived(payload);
      }
    }
  }
};

const applyOp = (action, opts) => {
  if (action === 'delete-component') {
    ComponentDelete.run(myEditor.getModel().getEditor(), null, opts, 0);
  } else if (action === 'append-component') {
  } else if (action === 'select-component') {
  } else if (action === 'copy-component') {
  } else if (action === 'update-content') {
  } else if (action === 'update-trait') {
  } else if (action === 'update-style') {
  }
};

export const setState = state => {
  ClientState = state;
};

// finish
export const ApplyingLocalOp = op => {
  //console.log("state: ApplyingLocalOp");
  // step 1: set localOp to the Op in the received LocalChange event
  localOp = op;

  // step 2: increment localTS
  localTS += 1;

  /************************************************************************************************/
  /***** The following statement are run in the applying function. e.g. ComponentDelete.run() *****/
  /************************************************************************************************/

  /*
    // step 3: call applyOp(localOp) (don't need)
    applyOp(localOp);

    // next state: SendingOpToController
    ClientState = ClientStateEnum.SendingOpToController;
    console.log("state: SendingOpToController");
    SendingOpToController();
    */
};

// finish
export const ApplyingBufferedLocalOp = op => {
  //console.log("state: ApplyingBufferedLocalOp");
  // step 1: add Op from the received LocalChange event to opBuffer
  opBuffer.push(op);

  /************************************************************************************************/
  /***** The following statement are run in the applying function. e.g. ComponentDelete.run() *****/
  /************************************************************************************************/

  /*
    // step 2: call applyOp(opBuffer.last)
    applyOp(opBuffer[opBuffer.length-1]);

    // next state: AwaitingWithBuffer
    ClientState = ClientStateEnum.AwaitingWithBuffer;
    console.log("state: AwaitingWithBuffer");
    */
};

const CreatingLocalOpFromBuffer = () => {
  //console.log("state: CreatingLocalOpFromBuffer");
  // step 1: increment localTS
  localTS += 1;

  // step 2: set localOp to opBuffer.first
  localOp = opBuffer[0];

  // step 3: remove opBuffer.first from opBuffer
  opBuffer.shift();

  // next state: SendingOpToController
  ClientState = ClientStateEnum.SendingOpToController;
  console.log('state: SendingOpToController');
  SendingOpToController();
};

const ApplyingRemoteOp = StoC_msg => {
  //console.log("state: ApplyRemoteOp");
  // step 1: set remoteTS and remoteOp to the values within the received StoC Msg event
  remoteOp = CircularJSON.parse(StoC_msg.op);
  remoteTS = StoC_msg.ts;

  // step 2: set localTS to the value of remoteTS
  localTS = remoteTS;

  // step 3: call applyOp(remoteOp)
  applyOp(remoteOp.action, remoteOp.opts);

  // next state: Synced
  ClientState = ClientStateEnum.Synced;
  console.log('state: Synced');
};

const ApplyingRemoteOpWithoutACK = StoC_msg => {
  //console.log("state: ApplyingRemoteOpWithoutACK");
  // step 1: set localTS to remoteTS
  localTS = StoC_msg.ts;

  // step 2: increment localTS
  localTS += 1;

  // step 3: set remoteTS and remoteOp to the values within the received StoC Msg event
  remoteTS = StoC_msg.ts;
  remoteOp = CircularJSON.parse(StoC_msg.op);

  // step 4: obtain remoteOpPrime and localOpPrime by evaluating xform(remoteOp, localOp)
  //console.log("local: " + JSON.stringify(localOp));
  //console.log("remote: " + JSON.stringify(remoteOp));
  remoteOpPrime = OT(remoteOp, localOp);
  localOpPrime = OT(localOp, remoteOp);

  // step 5: call applyOp(remoteOpPrime)
  //console.log(JSON.stringify(remoteOpPrime));
  applyOp(remoteOpPrime);

  // step 6: set localOp to the value of localOpPrime
  localOp = localOpPrime;

  // next state: SendingOpToController
  ClientState = ClientStateEnum.SendingOpToController;
  console.log('state: SendingOpToController');
  SendingOpToController();
};

const ApplyingRemoteOpWithBuffer = StoC_msg => {
  remoteOp = CircularJSON.parse(StoC_msg.op);
  remoteTS = StoC_msg.ts;
  let remoteOpPrimeArray = new Array();
  // step 1: set localTS to remoteTS
  localTS = remoteTS;

  // step 2: increment localTS
  localTS += 1;

  // step 3: obtain remoteOpPrime[0] by evaluating xform(remoteOp, localOp)
  remoteOpPrimeArray[0] = OT(remoteOp, localOp);

  // step 4: obtain remoteOpPrime[i+1] by evaluating xform(remoteOpPrime[i], opBuffer[i])
  for (let i = 0; i < opBuffer.length; i++) {
    remoteOpPrimeArray[i + 1] = OT(remoteOpPrimeArray[i], opBuffer[i]);
  }

  // step 5: call applyOp(remoteOpPrime.last)
  applyOp(remoteOpPrimeArray[remoteOpPrimeArray.length - 1]);

  // step 6: obtain localOpPrime by evaluating xform(localOp, remoteOp)
  localOpPrime = OT(localOp, remoteOp);

  // step 7: set localOp to the value of localOpPrime
  localOp = localOpPrime;

  // step 8: obtain opBuffer[i] by evaluating xform(opBuffer[i], remoteOpPrime[i]) & send
  for (let j = 0; j < opBuffer.length; j++) {
    opBuffer[j] = OT(opBuffer[j], remoteOpPrimeArray[j]);
  }

  // next state: SendingOpToController
  ClientState = ClientStateEnum.SendingOpToController;
  console.log('state: SendingOpToController');
  SendingOpToController();
};

// finish
export const SendingOpToController = op => {
  // send Op to controller
  //localTS += 1;
  let CtoS_Msg = {
    sender: username,
    sessionId: sessionId,
    type: 'OP',
    ts: localTS,
    op: CircularJSON.stringify(op),
  };
  stompClient.send('/app/chat.send', {}, CircularJSON.stringify(CtoS_Msg));

  // buffer is empty => AwaitingACK state
  if (opBuffer.length <= 0) {
    ClientState = ClientStateEnum.AwaitingACK;
    console.log('state: AwaitingACK');
  }
  // buffer is not empty => AwaitingWithBuffer state
  else {
    ClientState = ClientStateEnum.AwaitingWithBuffer;
    console.log('state: AwaitingWithBuffer');
  }
};