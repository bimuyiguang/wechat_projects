"use client"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { Languages } from "lucide-react"

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  const toggleLanguage = () => {
    setLanguage(language === "zh" ? "en" : "zh")
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggleLanguage} className="flex items-center space-x-2">
      <Languages className="w-4 h-4" />
      <span className="text-sm font-medium">{language === "zh" ? "English" : "中文"}</span>
    </Button>
  )
}
