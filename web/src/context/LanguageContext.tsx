/**
 * @archivo LanguageContext.tsx
 * @descripcion
 *
 * Sistema internacionalización.
 *
 * Idiomas iniciales:
 * - Español Latinoamérica
 * - Inglés
 */

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";


export type Language =
  | "es-LA"
  | "en-US";



interface LanguageContextType {

  language: Language;

  changeLanguage:
    (
      language: Language
    ) => void;

}



const LanguageContext =
  createContext<
    LanguageContextType | undefined
  >(undefined);



export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {


  const [language,setLanguage] =
    useState<Language>("es-LA");



  function changeLanguage(
    newLanguage: Language
  ){

    setLanguage(newLanguage);

  }



  return (

    <LanguageContext.Provider

      value={{
        language,
        changeLanguage,
      }}

    >

      {children}

    </LanguageContext.Provider>

  );

}



export function useLanguage(){

  const context =
    useContext(LanguageContext);


  if(!context){

    throw new Error(
      "useLanguage debe utilizarse dentro de LanguageProvider"
    );

  }


  return context;

}