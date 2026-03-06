"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Download, Upload, AlertCircle } from "lucide-react"
import { useState } from "react"

export default function ExcelPage() {
    const [downloading, setDownloading] = useState(false)

    const handleDownload = async () => {
        setDownloading(true)
        try {
            const response = await fetch('/api/excel/generate')
            if (!response.ok) throw new Error('Échec de la génération')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Inventaire_Parc_${new Date().toISOString().split('T')[0]}.xlsx`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error(error)
            alert("Une erreur est survenue lors de la génération du fichier.")
        } finally {
            setDownloading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Gestion Excel</h1>
                <p className="text-muted-foreground">
                    Générez vos rapports d'inventaire basés sur les dernières données scannées.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5 text-primary" /> Exportation Globale
                        </CardTitle>
                        <CardDescription>
                            Génère un fichier Excel consolidé contenant toutes les machines synchronisées.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center gap-4">
                        <div className="rounded-lg bg-muted p-4 text-sm">
                            <p className="font-semibold mb-2 flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4" /> Modèle utilisé :
                            </p>
                            <code className="text-xs">Modèle_fiche_synthèse.xlsx</code>
                        </div>
                        <Button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="w-full"
                        >
                            {downloading ? "Génération en cours..." : "Télécharger l'Inventaire Complet"}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-dashed">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-blue-500" /> Mise à jour du Modèle
                        </CardTitle>
                        <CardDescription>
                            Déposez un nouveau fichier .xlsx pour changer le template de génération.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/20">
                        <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground text-center">
                            Glissez-déposez votre fichier ici ou cliquez pour parcourir.
                        </p>
                        <Button variant="outline" className="mt-4" disabled>
                            Indisponible (Coming Soon)
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                    <strong>Note :</strong> L'export respecte exactement la structure de l'onglet "Serveurs et postes clients". Assurez-vous que votre modèle possède cet onglet.
                </p>
            </div>
        </div>
    )
}
