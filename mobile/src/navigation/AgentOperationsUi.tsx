/** @archivo AgentOperationsUi.tsx @descripcion Controles nativos para formularios operativos y mutaciones seguras. */
import { useRef,useState,type ReactNode } from 'react';
import { ActivityIndicator,Alert,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiMobile } from '../lib/api';
import { useThemeMobile } from '../providers/theme';
/** Mutaciones exclusivas; nunca simula una respuesta cuando falla la API. */
export function useOperationsAction(reload?:()=>void) {
  const locked=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  /** Devuelve datos del servidor y conserva errores en pantalla. */
  async function run<T>(path:string,body:unknown,method:'post'|'put'='post'):Promise<T|null> {
    if(locked.current)return null;locked.current=true;setBusy(true);setError('');
    try{const response=await apiMobile[method]<{exito:boolean;datos:T;mensaje?:string}>(path,body);
      if(!response.exito)throw new Error(response.mensaje??'Operacion no disponible.');reload?.();return response.datos;
    }catch(cause){setError(cause instanceof Error?cause.message:'Error de conexion.');return null;}
    finally{locked.current=false;setBusy(false);}
  }
  return {busy,error,run};
}
/** Confirmacion nativa antes de efectos o borrados. */
export function confirmOperation(message:string,action:()=>void):void {
  Alert.alert('Confirmar accion',message,[{text:'Volver',style:'cancel'},{text:'Confirmar',onPress:action}]);
}
/** Texto que respeta el tema de la aplicacion. */
export function OText({children,title=false}: {children:ReactNode;title?:boolean}) {
  const {colores}=useThemeMobile();return <Text style={{color:colores.texto,fontSize:title?20:15,fontWeight:title?'600':'400',marginVertical:6}}>{children}</Text>;
}
/** Comando con icono, altura tactil y estado disabled visible. */
export function OButton({label,onPress,disabled=false,icon='checkmark-outline'}:{label:string;onPress:()=>void;disabled?:boolean;icon?:keyof typeof Ionicons.glyphMap}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={[styles.button,disabled&&{opacity:.5}]}><Ionicons name={icon} size={19} color="#235b4b"/><Text style={{color:'#235b4b',fontSize:15,flexShrink:1}}>{label}</Text></Pressable>;
}
/** Campo con etiqueta persistente, limites y teclado apropiado. */
export function OInput({label,value,onChange,multiline=false,numeric=false,max=4000}:{label:string;value:string;onChange:(value:string)=>void;multiline?:boolean;numeric?:boolean;max?:number}) {
  const {colores}=useThemeMobile();return <View style={{marginVertical:8}}><OText>{label}</OText><TextInput accessibilityLabel={label}
    style={[styles.input,{color:colores.texto,backgroundColor:colores.superficie,borderColor:colores.borde},multiline&&{minHeight:100,textAlignVertical:'top'}]}
    multiline={multiline} keyboardType={numeric?'numeric':'default'} value={value} maxLength={max} onChangeText={onChange}/></View>;
}
/** Menu modal nativo, sin colecciones de botones ambiguos. */
export function OSelect({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:Array<{value:string;label:string}>}) {
  const [open,setOpen]=useState(false);const {colores}=useThemeMobile();
  return <View><OText>{label}</OText><OButton label={options.find(option=>option.value===value)?.label??'Seleccionar'} icon="chevron-down-outline" onPress={()=>setOpen(true)}/>
    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}>
      <View style={styles.backdrop}><View style={[styles.menu,{backgroundColor:colores.superficie}]}>
        <OText title>{label}</OText><ScrollView>{options.map(option=><OButton key={option.value} label={option.label}
          icon={value===option.value?'radio-button-on-outline':'radio-button-off-outline'} onPress={()=>{onChange(option.value);setOpen(false);}}/>)}</ScrollView>
        <OButton label="Cerrar" icon="close-outline" onPress={()=>setOpen(false)}/></View></View>
    </Modal></View>;
}
/** Recurso individual; las secciones no se envuelven en tarjetas anidadas. */
export function OItem({children}:{children:ReactNode}) {
  const {colores}=useThemeMobile();return <View style={[styles.item,{borderColor:colores.borde,backgroundColor:colores.superficie}]}>{children}</View>;
}
/** Feedback de red y de mutaciones sin datos simulados. */
export function OState({loading,error}:{loading?:boolean;error?:string}) {
  return <>{loading&&<ActivityIndicator accessibilityLabel="Cargando"/>}{!!error&&<Text accessibilityRole="alert" style={{color:'#a1273d',marginVertical:12}}>{error}</Text>}</>;
}
const styles=StyleSheet.create({
  button:{minHeight:44,paddingHorizontal:13,paddingVertical:10,backgroundColor:'#e5f2ed',borderRadius:6,flexDirection:'row',alignItems:'center',gap:8,marginVertical:5},
  input:{borderWidth:1,borderRadius:6,padding:12,minHeight:46,fontSize:16},
  item:{borderWidth:1,borderRadius:7,padding:14,marginVertical:8},
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'#00000066'},
  menu:{maxHeight:'75%',padding:22,paddingBottom:36},
});
