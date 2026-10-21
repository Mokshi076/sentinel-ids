"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import NavBar from "./NavBar";
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const path = usePathname(), router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("token") && path !== "/login") router.replace("/login"); else setOk(true);
  }, [path, router]);
  if (!ok) return null;
  return <>{path !== "/login" && <NavBar />}{children}</>;
}
