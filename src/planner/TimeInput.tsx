import React from 'react';
import { View } from 'react-native';
import SelectField from './SelectField';
import { TimeKind, timeParts, joinTime, numericOptions } from './timeValues';
export default function TimeInput({label,value,onChange,kind}: {label:string;value:string;onChange:(value:string)=>void;kind:TimeKind}) {
  const parts = value ? timeParts(value,kind) : Array(kind === 'duration' ? 3 : 2).fill('');
  const scalar = kind === 'minutes' || kind === 'seconds';
  if (scalar) return <SelectField label="" accessibilityLabel={label} value={value} options={numericOptions(label,value)} onChange={onChange}/>;
  const units = kind === 'duration' ? ['時間','分','秒'] : kind === 'clock' ? ['時','分'] : ['分','秒'];
  return <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{units.map((unit,i)=> {
    const max = i === 0 ? kind === 'clock' ? 23 : kind === 'pace' ? 120 : 99 : 59;
    const values = Array.from({length:max+1},(_,n)=>String(n));
    if (parts[i] && !values.includes(parts[i])) values.push(parts[i]);
    return <View key={unit} style={{flex:1,minWidth:70}}><SelectField label="" accessibilityLabel={`${label}：${unit}`} value={parts[i]} options={[{value:'',label:'未設定'},...values.map(v=>({value:v,label:`${v}${unit}`}))]} onChange={v=>{ if (!v) {onChange('');return;} const next=parts.map(p=>p || '0');next[i]=v;onChange(joinTime(next,kind));}}/></View>;
  })}</View>;
}
