"use client";
import {createContext,useContext,useEffect,useState} from "react";
type Value={saved:string[];toggle:(id:string)=>void}; const Context=createContext<Value>({saved:[],toggle:()=>{}});
export function SavedProvider({children}:{children:React.ReactNode}){const [saved,setSaved]=useState<string[]>([]);useEffect(()=>{try{setSaved(JSON.parse(localStorage.getItem("crr-saved")||"[]"))}catch{};const sync=()=>{try{setSaved(JSON.parse(localStorage.getItem("crr-saved")||"[]"))}catch{}};window.addEventListener("crr-saved",sync);return()=>window.removeEventListener("crr-saved",sync)},[]);const toggle=(id:string)=>setSaved(current=>{const next=current.includes(id)?current.filter(x=>x!==id):[...current,id];localStorage.setItem("crr-saved",JSON.stringify(next));return next});return <Context.Provider value={{saved,toggle}}>{children}</Context.Provider>}
export const useSaved=()=>useContext(Context);
