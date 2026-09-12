import React from 'react';
import { View } from 'react-native';
import SelectField from './SelectField';
import { distanceParts, joinDistance } from './timeValues';
export default function DistanceInput({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}) {
  const parts=distanceParts(value);
  return <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{['km','m'].map((unit,i)=>{
    const values=Array.from({length:i===0?1001:1000},(_,n)=>String(n));
    if(i===1) values.push('97.5');
    if(parts[i] && !values.includes(parts[i])) values.push(parts[i]);
    return <View key={unit} style={{flex:1,minWidth:80}}><SelectField label="" accessibilityLabel={`${label}：${unit}`} value={parts[i]} options={[{value:'',label:'未設定'},...values.map(v=>({value:v,label:`${v}${unit}`}))]} onChange={v=>{if(!v){onChange('');return;}const next=parts.map(p=>p||'0');next[i]=v;onChange(joinDistance(next[0],next[1]));}}/></View>;
  })}</View>;
}
