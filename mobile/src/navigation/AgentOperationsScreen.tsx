/** @archivo AgentOperationsScreen.tsx @descripcion Navegacion nativa del espacio operativo, por rol. */
import { useState } from 'react';
import { KeyboardAvoidingView,Platform,ScrollView,Pressable,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMobile } from '../providers/theme';
import { useAuthMobile } from '../context/AuthContext';
import { MobileSalesPanel,MobileMarketingPanel } from './MobileGrowthPanels';
import { MobileSupportPanel,MobileKnowledgePanel } from './MobileSupportPanels';
import { MobileIntelligencePanel,MobileRunsPanel,MobileGovernancePanel } from './MobileIntelligencePanels';
import { OText } from './AgentOperationsUi';
import { MobileOperationsPanel,MobileCommandCenterPanel } from './MobileOperationsPanels';
/** Pestañas desplazables y teclado protegido, sin depender de una vista web incrustada. */
export function AgentOperationsScreen() {
  const {usuario}=useAuthMobile();const {colores}=useThemeMobile();const [tab,setTab]=useState('support');
  const tabs=[['support','Soporte'],['intelligence','Analisis'],['knowledge','Memoria'],['runs','Agentes'],['sales',usuario?.rol==='admin'?'CRM':'Preferencias'],
    ...(usuario?.rol==='admin'?[['marketing','Marketing'],['governance','Gobierno IA'],['admin','Administracion'],['center','Command Center']]:[])];
  return <SafeAreaView style={{flex:1,backgroundColor:colores.fondo}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View style={{paddingHorizontal:18,paddingTop:8}}><OText title>Operaciones OfiAI</OText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginVertical:8}}>
        {tabs.map(([id,label])=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:tab===id}} onPress={()=>setTab(id!)}
          style={{minHeight:44,padding:12,borderBottomWidth:2,borderBottomColor:tab===id?colores.primario:'transparent'}}>
          <Text style={{color:colores.texto}}>{label}</Text></Pressable>)}
      </ScrollView></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,paddingBottom:70}}>
      <View key={tab}>{tab==='admin'&&usuario?.rol==='admin'?<MobileOperationsPanel/>:tab==='center'&&usuario?.rol==='admin'?<MobileCommandCenterPanel/>:tab==='sales'?<MobileSalesPanel/>:tab==='marketing'&&usuario?.rol==='admin'?<MobileMarketingPanel/>:tab==='knowledge'?<MobileKnowledgePanel/>
        :tab==='intelligence'?<MobileIntelligencePanel/>:tab==='runs'?<MobileRunsPanel/>:tab==='governance'&&usuario?.rol==='admin'?<MobileGovernancePanel/>:<MobileSupportPanel/>}</View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
