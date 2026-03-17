"use client"

import { useEffect, useState } from "react"
import { getMachines } from "@/app/actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Search,
    Monitor,
    Server as ServerIcon,
    Cpu,
    HardDrive,
    ExternalLink
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function InventoryPage() {
    const [machines, setMachines] = useState<any[]>([])
    const [search, setSearch] = useState("")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const data = await getMachines()
            setMachines(data)
            setLoading(false)
        }
        load()
    }, [])

    const filteredMachines = machines.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.os.toLowerCase().includes(search.toLowerCase()) ||
        m.service_tag.toLowerCase().includes(search.toLowerCase()) ||
        (m.ip && m.ip.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inventaire du Parc</h1>
                    <p className="text-muted-foreground">
                        Liste complète de toutes les machines scannées et synchronisées.
                    </p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher (Nom, OS, Tag)..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
            ) : filteredMachines.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
                    <p className="text-muted-foreground">Aucune machine trouvée.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredMachines.map((m) => (
                        <Card key={m.id} className="overflow-hidden hover:border-primary/50 transition-colors">
                            <CardHeader className="bg-muted/30 pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {m.name.startsWith("SRV") ? (
                                            <ServerIcon className="h-5 w-5 text-blue-500" />
                                        ) : (
                                            <Monitor className="h-5 w-5 text-green-500" />
                                        )}
                                        <CardTitle className="text-lg">{m.name}</CardTitle>
                                    </div>
                                    <Badge variant={m.name.startsWith("SRV") ? "default" : "secondary"}>
                                        {m.name.startsWith("SRV") ? "Serveur" : "Client"}
                                    </Badge>
                                </div>
                                <CardDescription className="flex flex-col gap-0.5">
                                    <span>{m.os}</span>
                                    {m.ip && <span className="text-[10px] font-mono text-primary/70">{m.ip}</span>}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <Cpu className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{m.cpu}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                                    <span>{m.ram} RAM • {m.disks?.length || 0} Disques</span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                                    <span>Tag: {m.service_tag}</span>
                                    <span>Dernier scan: {new Date(m.last_scan).toLocaleDateString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
