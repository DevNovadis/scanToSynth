"use client"

import { useEffect, useState, useRef } from "react"
import { getMachines, triggerScan, getImportInfo, deleteMachines } from "@/app/actions"
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
  Upload,
  CheckCircle2,
  Trash2
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
  const [uploading, setUploading] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState<any>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [importInfo, setImportInfo] = useState<{ filename: string, date: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [m, info] = await Promise.all([getMachines(), getImportInfo()])
      setMachines(m)
      setImportInfo(info)
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
      alert("Erreur lors du scan.")
    } finally {
      setScanning(false)
    }
  }

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
      alert("Une erreur est survenue lors du téléchargement.")
    } finally {
      setDownloading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch('/api/excel/upload', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || "Erreur lors de l'importation")
      }

      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
      await loadData()
    } catch (error) {
      console.error(error)
      alert("Erreur lors de l'importation du fichier.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleReset = async () => {
    if (!confirm("Voulez-vous vraiment retirer le fichier importé ? Les données scannées seront conservées.")) return
    setResetting(true)
    try {
      const response = await fetch('/api/excel/upload', { method: 'DELETE' })
      if (!response.ok) throw new Error('Échec de la réinitialisation')
      await loadData()
    } catch (error) {
      console.error(error)
      alert("Erreur lors de la réinitialisation.")
    } finally {
      setResetting(false)
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

    setDeleting(true)
    try {
      const res = await deleteMachines(selectedIds) as { success: boolean, error?: string }
      if (res.success) {
        setSelectedIds([])
        await loadData()
      } else {
        alert("Erreur lors de la suppression : " + (res.error || "Réponse invalide"))
      }
    } catch (error) {
      console.error(error)
      alert("Erreur lors de la suppression : " + (error instanceof Error ? error.message : String(error)))
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
            <Button
              variant="default"
              size="lg"
              className="rounded-xl shadow-lg shadow-primary/20"
              onClick={() => handleScan('Local')}
              disabled={scanning}
            >
              <Zap className={`mr-2 h-4 w-4 ${scanning ? 'animate-pulse' : ''}`} />
              Scanner ce PC
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" className="rounded-xl" disabled={scanning}>
                  <Globe className="mr-2 h-4 w-4" />
                  Scan Réseau
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-56">
                <DropdownMenuItem onClick={() => handleScan('AD')} className="py-3">
                  <Zap className="mr-2 h-4 w-4 text-blue-500" />
                  Active Directory (CLT/SRV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleScan('IPRange')} className="py-3">
                  <Network className="mr-2 h-4 w-4 text-orange-500" />
                  Plage IP (192.168.200.x)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="lg" onClick={loadData} className="rounded-xl">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Specific Target Scan */}
        <div className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Scanner une cible spécifique (Nom ou IP)..."
              className="pl-9 rounded-xl"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan('Target', target)}
            />
          </div>
          <Button
            variant="secondary"
            className="rounded-xl px-6"
            onClick={() => handleScan('Target', target)}
            disabled={scanning || !target}
          >
            Lancer
          </Button>
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
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Gestion Excel</h3>

            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              ref={fileInputRef}
              onChange={handleUpload}
            />

            <Button
              className="w-full rounded-xl gap-2 font-bold py-6 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploadSuccess ? <CheckCircle2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
              {uploading ? "Importation..." : uploadSuccess ? "Importé !" : "Importer Fichier"}
            </Button>

            <Button
              className="w-full rounded-xl gap-2 font-bold py-6"
              variant="outline"
              onClick={handleDownload}
              disabled={downloading || machines.length === 0}
            >
              <Download className="h-5 w-5" />
              Exporter (.xlsx)
            </Button>

            <Button
              className="w-full rounded-xl gap-2 font-bold py-6 bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
            >
              <Trash2 className="h-5 w-5" />
              {resetting ? "Suppression..." : "Retirer l'import"}
            </Button>

            {importInfo && (
              <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  IMPORTÉ
                </div>
                <p className="text-xs font-medium truncate">{importInfo.filename}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Le {new Date(importInfo.date).toLocaleDateString()}
                </p>
              </div>
            )}
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

                      <div className="mt-6 pt-6 border-t flex justify-end">
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
