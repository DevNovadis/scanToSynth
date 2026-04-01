"use client"

import { useEffect, useState } from "react"
import { getMachines, triggerScan, deleteMachines } from "@/app/actions"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search,
  Monitor,
  Server as ServerIcon,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Globe,
  Zap,
  Network,
  Cpu,
  Info,
  HardDrive,
  Settings,
  CheckCircle2,
  Trash2,
  Terminal,
  Copy,
  Check
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function HomePage() {
  const [machines, setMachines] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [target, setTarget] = useState("")
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)
  const [showScanHelp, setShowScanHelp] = useState(false)
  const [copied, setCopied] = useState(false)

  const scanCommand = `powershell -ExecutionPolicy Bypass -Command "& { irm 'https://raw.githubusercontent.com/Gartalgart/scanToSynth/master/web-dashboard/scan-to-cloud.ps1' -OutFile $env:TEMP\\scan.ps1; & $env:TEMP\\scan.ps1 }"`

  const handleCopy = () => {
    navigator.clipboard.writeText(scanCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const m = await getMachines()
      setMachines(m)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleScan = async (action: 'Local' | 'AD' | 'IPRange' | 'Target', val?: string) => {
    setScanning(true)
    try {
      await triggerScan(action, val)
      await loadData()
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes("Vercel") || msg.includes("agent local")) {
        alert("Le scan direct n'est pas disponible en mode cloud.\n\nUtilisez le script PowerShell en local pour scanner et envoyer les résultats vers ce dashboard.")
      } else {
        alert("Erreur lors du scan : " + msg)
      }
    } finally {
      setScanning(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const idsToExport = selectedIds.length > 0 ? selectedIds : undefined
      const response = idsToExport
        ? await fetch('/api/excel/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columnIds: idsToExport }),
          })
        : await fetch('/api/excel/generate')
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
      alert("Une erreur est survenue lors du téléchargement.")
    } finally {
      setDownloading(false)
    }
  }

  const handleDeleteOne = async (id: number, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm(`Supprimer la machine "${name}" ?`)) return
    setDeleting(true)
    // Mise à jour optimiste immédiate
    setMachines(prev => prev.filter(m => m.id !== id))
    setSelectedIds(prev => prev.filter(i => i !== id))
    try {
      const res = await deleteMachines([id]) as { success: boolean, error?: string }
      if (!res.success) {
        alert("Erreur : " + (res.error || "Échec"))
        await loadData() // Restaurer l'état réel en cas d'erreur
      }
    } catch (error) {
      alert("Erreur : " + (error instanceof Error ? error.message : String(error)))
      await loadData()
    } finally {
      setDeleting(false)
    }
  }

  const filteredMachines = machines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.os.toLowerCase().includes(search.toLowerCase()) ||
    (m.ip && m.ip.toLowerCase().includes(search.toLowerCase()))
  )

  const toggleSelect = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMachines.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredMachines.map(m => m.id))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Voulez-vous vraiment supprimer les ${selectedIds.length} machines sélectionnées ?`)) return

    const idsToDelete = [...selectedIds]
    setDeleting(true)
    // Mise à jour optimiste immédiate
    setMachines(prev => prev.filter(m => !idsToDelete.includes(m.id)))
    setSelectedIds([])
    try {
      const res = await deleteMachines(idsToDelete) as { success: boolean, error?: string }
      if (!res.success) {
        alert("Erreur lors de la suppression : " + (res.error || "Réponse invalide"))
        await loadData()
      }
    } catch (error) {
      console.error(error)
      alert("Erreur lors de la suppression : " + (error instanceof Error ? error.message : String(error)))
      await loadData()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Dynamic Scan Toolbar */}
      <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Novadis <span className="text-primary tracking-tighter">SCANNER</span></h1>
            <p className="text-muted-foreground font-medium">Capturez les données de votre réseau en direct.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={showScanHelp} onOpenChange={setShowScanHelp}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  size="lg"
                  className="rounded-xl shadow-lg shadow-primary/20"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Scanner un PC
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-primary" />
                    Scanner une machine
                  </DialogTitle>
                  <DialogDescription>
                    Exécutez cette commande PowerShell sur la machine à scanner :
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {scanCommand}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-8 w-8 p-0"
                      onClick={handleCopy}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Comment faire :</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Ouvrez <span className="font-mono text-primary">PowerShell</span> sur la machine cible</li>
                      <li>Collez la commande ci-dessus</li>
                      <li>Les données apparaîtront ici automatiquement</li>
                    </ol>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="ghost" size="lg" onClick={loadData} className="rounded-xl">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="grid gap-6 md:grid-cols-4 pt-4">
        <div className="md:col-span-1 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Filtrer les résultats</h3>
            <Input
              placeholder="Chercher dans la liste..."
              className="rounded-xl bg-muted/50 border-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredMachines.length > 0 && (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start px-2 font-semibold text-xs text-muted-foreground hover:text-primary"
                onClick={toggleSelectAll}
              >
                <div className={`w-4 h-4 rounded border-2 mr-2 flex items-center justify-center transition-colors ${selectedIds.length === filteredMachines.length && filteredMachines.length > 0 ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                  {selectedIds.length === filteredMachines.length && filteredMachines.length > 0 && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                </div>
                {selectedIds.length === filteredMachines.length ? "Tout décocher" : "Tout cocher"}
              </Button>

              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-xl w-full gap-2 animate-in slide-in-from-left duration-200"
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer sélection ({selectedIds.length})
                </Button>
              )}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Export</h3>

            <Button
              className="w-full rounded-xl gap-2 font-bold py-6"
              variant="outline"
              onClick={handleDownload}
              disabled={downloading || machines.length === 0}
            >
              <Download className="h-5 w-5" />
              {downloading ? "Export..." : "Exporter (.xlsx)"}
            </Button>
          </div>
        </div>

        <div className="md:col-span-3">
          {loading && machines.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : filteredMachines.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted text-center p-6">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-medium">L'inventaire est vide.</p>
              <p className="text-sm text-muted-foreground/60 max-w-xs mt-1">Utilisez les outils ci-dessus pour scanner des machines ou importez un fichier existant.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMachines.map((m) => (
                <Dialog key={m.id}>
                  <DialogTrigger asChild>
                    <Card
                      className={`rounded-2xl border-muted/20 transition-all hover:shadow-md cursor-pointer group overflow-hidden relative ${selectedIds.includes(m.id) ? 'ring-2 ring-primary border-primary/40 bg-primary/5' : 'hover:border-primary/40'}`}
                      onClick={() => setSelectedMachine(m)}
                    >
                      {/* Checkbox Overlay */}
                      <div
                        className="absolute top-4 left-4 z-10"
                        onClick={(e) => toggleSelect(m.id, e)}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.includes(m.id) ? 'bg-primary border-primary scale-110 shadow-lg' : 'bg-background/80 border-muted-foreground/30 group-hover:border-primary/50'}`}>
                          {selectedIds.includes(m.id) && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                        </div>
                      </div>

                      {/* Delete button */}
                      <div
                        className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteOne(m.id, m.name, e)}
                      >
                        <div className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </div>
                      </div>

                      <div className="h-1 w-full bg-muted group-hover:bg-primary transition-colors" />
                      <CardContent className="p-5 pt-12">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${m.name.startsWith('SRV') ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                              {m.name.startsWith("SRV") ? <ServerIcon className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-lg leading-none">{m.name}</p>
                              <p className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]">{m.os}</p>
                              {m.ip && <p className="text-[10px] font-mono text-primary/70 mt-0.5">{m.ip}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="rounded-lg text-[10px] uppercase font-bold tracking-tighter">
                              {m.ram}
                            </Badge>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Info className="h-3 w-3" /> hardware
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  {selectedMachine && selectedMachine.id === m.id && (
                    <DialogContent className="sm:max-w-2xl rounded-3xl pb-8">
                      <DialogHeader>
                        <div className="flex items-center gap-4 mb-2">
                          <div className={`p-3 rounded-2xl ${selectedMachine.name.startsWith('SRV') ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                            {selectedMachine.name.startsWith("SRV") ? <ServerIcon className="h-8 w-8" /> : <Monitor className="h-8 w-8" />}
                          </div>
                          <div>
                            <DialogTitle className="text-2xl font-bold">{selectedMachine.name}</DialogTitle>
                            <DialogDescription className="text-md font-medium text-primary/80">{selectedMachine.os}</DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>

                      <div className="grid gap-6 py-4 md:grid-cols-2">
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Système</h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                              <Settings className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-xs text-muted-foreground">Fabricant / Modèle</p>
                                <p className="text-sm font-bold">{selectedMachine.manufacturer} {selectedMachine.model}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                              <div className="h-5 w-5 flex items-center justify-center font-bold text-xs text-muted-foreground border-2 border-muted-foreground rounded">#</div>
                              <div>
                                <p className="text-xs text-muted-foreground">Service Tag / Serial</p>
                                <p className="text-sm font-bold">{selectedMachine.service_tag}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Composants</h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                              <Cpu className="h-5 w-5 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">Processeur</p>
                                <p className="text-sm font-bold">{selectedMachine.cpu}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                              <Zap className="h-5 w-5 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">Mémoire Vive (RAM)</p>
                                <p className="text-sm font-bold">{selectedMachine.ram}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedMachine.disks && selectedMachine.disks.length > 0 && (
                        <div className="space-y-4 pt-4">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Stockage ({selectedMachine.disks.length})</h4>
                          <div className="grid gap-2 grid-cols-1">
                            {selectedMachine.disks.map((disk: string, iIdx: number) => (
                              <div key={iIdx} className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-muted/30">
                                <HardDrive className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm font-medium">{disk}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 pt-6 border-t flex justify-between">
                        <Button
                          variant="destructive"
                          className="rounded-xl gap-2"
                          disabled={deleting}
                          onClick={() => handleDeleteOne(selectedMachine.id, selectedMachine.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </Button>
                        <Button variant="secondary" className="rounded-xl px-10" onClick={() => setSelectedMachine(null)}>
                          Fermer
                        </Button>
                      </div>
                    </DialogContent>
                  )}
                </Dialog>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
