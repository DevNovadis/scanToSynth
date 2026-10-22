"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KeyRound, Copy, Check, Terminal } from "lucide-react"
import { useEffect, useState } from "react"
import { getAgentConfig } from "@/app/actions"

export default function ApiKeyPage() {
    const [copied, setCopied] = useState(false)
    const [apiKey, setApiKey] = useState("")
    const [apiUrl, setApiUrl] = useState("")

    useEffect(() => {
        getAgentConfig().then(c => { setApiKey(c.apiKey); setApiUrl(c.apiUrl) }).catch(() => {})
    }, [])

    const handleCopy = () => {
        navigator.clipboard.writeText(apiKey)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-center">Configuration de l'Agent</h1>
                <p className="text-muted-foreground text-center">
                    Paramètres pour connecter votre script PowerShell à cette interface.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-yellow-500" /> Clé d'API (Agent)
                    </CardTitle>
                    <CardDescription>
                        Utilisez cette clé dans votre script PowerShell pour autoriser l'envoi de données.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                readOnly
                                value={apiKey}
                                className="font-mono bg-muted"
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={handleCopy}>
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>

                    <div className="rounded-lg bg-black p-4 text-sm text-green-400 font-mono">
                        <p className="flex items-center gap-2 mb-2 text-white/50">
                            <Terminal className="h-4 w-4" /> Exemple d'usage PowerShell :
                        </p>
                        <p>.\script_fiche_synthèse_poste_serveur.ps1 -ApiKey "{apiKey}" -ApiUrl "{apiUrl}"</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Statut de la Synchronisation</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm">Endpoint API</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">/api/scan/submit</code>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm">Dernière activité</span>
                        <span className="text-sm text-muted-foreground">En attente de données...</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
