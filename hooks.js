import { useEffect, useRef, useState } from 'react';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  useEffect(() => { (async () => setUser(await window.websim.getCurrentUser()))(); }, []);
  return user;
}

export function useCreator() {
  const [creator, setCreator] = useState(null);
  useEffect(() => { (async () => setCreator(await window.websim.getCreator()))(); }, []);
  return creator;
}

export function useToast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timeout = useRef();
  const api = (text) => {
    setMsg(text); setShow(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setShow(false), 2200);
  };
  return { msg, show, push: api };
}