import React, { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleProp, TextStyle } from 'react-native';
import SelectField from './SelectField';
import { TimeKind, normalizeTime, timeParts, joinTime } from './timeValues';
export default function TimeInput({label,value,onChange,kind,inputStyle}: {label:string;value:string;onChange:(value:string)=>void;kind:TimeKind;inputStyle:StyleProp<TextStyle>}) {
  const [open,setOpen] = useState(false);
  const parts = timeParts(value,kind);
  const scalar = kind === 'minutes' || kind === 'seconds';
  const units = kind === 'duration' ? ['時間','分','秒'] : kind === 'clock' ? ['時','分'] : kind === 'pace' ? ['分','秒'] : [kind === 'minutes' ? '分' : '秒'];
  return <View style={{gap:8}}>
    <TextInput accessibilityLabel={label} value={value} onChangeText={v=>onChange(normalizeTime(v))} style={inputStyle} autoCapitalize="none" autoCorrect={false} maxLength={20}/>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}を数字で選択`} accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={{paddingVertical:10,alignSelf:'flex-start'}}><Text style={{color:'#164d3c',fontWeight:'600'}}>数字で選択 {open ? '▴' : '▾'}</Text></Pressable>
    {open && <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{units.map((unit,i)=> {
      const max = scalar ? 120 : i === 0 ? kind === 'clock' ? 23 : 99 : 59;
      const values = Array.from({length:max+1},(_,n)=>String(n));
      if (scalar && kind === 'seconds') values.push('180','300','600','900');
      if (!values.includes(parts[i])) values.push(parts[i]);
      return <View key={unit} style={{flex:1,minWidth:75}}><SelectField label={unit} accessibilityLabel={`${label}：${unit}`} value={parts[i]} options={values.map(v=>({value:v,label:`${v}${unit}`}))} onChange={v=>{const next=[...parts];next[i]=v;onChange(joinTime(next,kind));}}/></View>;
    })}</View>}
  </View>;
}
