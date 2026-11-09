/**
 * PvP state isolated from TuşLab's existing single-player game.
 * This package intentionally does not open WebSockets or award XP.
 * All transitions are pure so later networking code can be tested in Node.
 */
export const PvPView = Object.freeze({CLOSED:'closed', HOME:'home'});
export const PvPConnection = Object.freeze({UNCONFIGURED:'unconfigured'});
export const PvPVersion = 1;

export const initialPvPState = () => ({
  version: PvPVersion,
  view: PvPView.CLOSED,
  connection: PvPConnection.UNCONFIGURED,
  roomId: null,
  opponent: null,
  selectedCharacter: null,
  match: null,
});

export function pvpReducer(state, action) {
  switch(action?.type) {
    case 'PVP_OPEN':
      return {...state,view:PvPView.HOME};
    case 'PVP_CLOSE':
      return {...state,view:PvPView.CLOSED};
    case 'PVP_RESET':
      return initialPvPState();
    default:
      return state;
  }
}

export function createPvPStore(reducer=pvpReducer,initial=initialPvPState()) {
  let state=initial;
  const listeners=new Set();
  return {
    getState:()=>state,
    subscribe(fn){if(typeof fn!=='function')throw new TypeError('listener must be function');listeners.add(fn);return ()=>listeners.delete(fn)},
    dispatch(action){const next=reducer(state,action);if(next!==state){state=next;for(const fn of [...listeners])fn(state,action)}return state;},
  };
}
