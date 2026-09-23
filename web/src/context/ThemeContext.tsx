/**
 * @archivo ThemeContext.tsx
 * @descripcion
 * Gestión global del tema visual.
 *
 * Preparado para:
 * - Light mode
 * - Dark mode
 * - Preferencia del usuario
 */

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";


export type Theme =
  | "light"
  | "dark";


interface ThemeContextType {

  theme: Theme;

  toggleTheme: () => void;

}



const ThemeContext =
  createContext<ThemeContextType | undefined>(
    undefined
  );



export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {


  const [theme, setTheme] =
    useState<Theme>("light");



  function toggleTheme(){

    setTheme(
      previous =>
        previous === "light"
          ? "dark"
          : "light"
    );

  }



  return (

    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
      }}
    >

      {children}

    </ThemeContext.Provider>

  );

}



export function useTheme(){

  const context =
    useContext(ThemeContext);


  if(!context){

    throw new Error(
      "useTheme debe utilizarse dentro de ThemeProvider"
    );

  }


  return context;

}
