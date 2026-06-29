import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  TimecodeUpdate,
  Cue,
  CueStateUpdate,
  DeviceConnection,
  TransportCommand,
  ClockMode,
  FrameRate,
  Timecode,
} from '../types';

interface UseSocketReturn {
  timecodeUpdate: TimecodeUpdate | null;
  cues: Cue[];
  cueState: CueStateUpdate | null;
  deviceStatuses: DeviceConnection[];
  isConnected: boolean;
  sendTransportCommand: (command: TransportCommand) => void;
  sendClockMode: (mode: ClockMode) => void;
  sendFrameRate: (rate: FrameRate) => void;
  sendTimecodeSet: (timecode: Timecode) => void;
}

const SOCKET_URL = `ws://${window.location.hostname}:3001`;

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [timecodeUpdate, setTimecodeUpdate] = useState<TimecodeUpdate | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [cueState, setCueState] = useState<CueStateUpdate | null>(null);
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceConnection[]>([]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('timecode', (data: TimecodeUpdate) => {
      setTimecodeUpdate(data);
    });

    socket.on('cueList', (data: Cue[]) => {
      setCues(data);
    });

    socket.on('cueState', (data: CueStateUpdate) => {
      setCueState(data);
    });

    socket.on('deviceStatus', (data: { devices: DeviceConnection[] }) => {
      setDeviceStatuses(data.devices);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const sendTransportCommand = useCallback((command: TransportCommand) => {
    socketRef.current?.emit('transportCommand', { command });
  }, []);

  const sendClockMode = useCallback((mode: ClockMode) => {
    socketRef.current?.emit('setClockMode', { mode });
  }, []);

  const sendFrameRate = useCallback((rate: FrameRate) => {
    socketRef.current?.emit('setFrameRate', { rate });
  }, []);

  const sendTimecodeSet = useCallback((timecode: Timecode) => {
    socketRef.current?.emit('setTimecode', timecode);
  }, []);

  return {
    timecodeUpdate,
    cues,
    cueState,
    deviceStatuses,
    isConnected,
    sendTransportCommand,
    sendClockMode,
    sendFrameRate,
    sendTimecodeSet,
  };
}
