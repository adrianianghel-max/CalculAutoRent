import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function HolidayManager({ holidays, setHolidays, defaults }) {
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");

  const add = () => {
    if (!newDate) {
      toast.error("Alege o data pentru sarbatoare.");
      return;
    }
    const next = [...holidays, { date: newDate, name: newName || "Zi libera legala" }].sort(
      (a, b) => a.date.localeCompare(b.date)
    );
    setHolidays(next);
    setNewDate("");
    setNewName("");
    toast.success("Zi libera adaugata.");
  };

  const remove = (idx) => {
    const next = holidays.filter((_, i) => i !== idx);
    setHolidays(next);
  };

  const reset = () => {
    setHolidays(defaults);
    toast.success("Lista resetata la sarbatorile legale implicite.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="manage-holidays-trigger"
        >
          <CalendarDays className="h-4 w-4" />
          Zile libere ({holidays.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Zile libere legale (Romania)</DialogTitle>
          <DialogDescription>
            Aceste zile sunt considerate zile de service pierdute si se adauga automat in calculul
            de rent. Adauga sau elimina dupa nevoie.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Data</label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              data-testid="holiday-date-input"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Denumire</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ex. Craciunul"
              data-testid="holiday-name-input"
            />
          </div>
          <Button onClick={add} size="icon" data-testid="add-holiday-button">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
          {holidays.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nicio zi libera configurata.</p>
          )}
          {holidays.map((h, idx) => (
            <div
              key={`${h.date}-${idx}`}
              className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
              data-testid={`holiday-row-${idx}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono-num text-xs text-primary font-semibold">{h.date}</span>
                <span className="text-foreground/80">{h.name}</span>
              </div>
              <button
                onClick={() => remove(idx)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                data-testid={`remove-holiday-${idx}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reseteaza
          </Button>
          <Button size="sm" onClick={() => setOpen(false)} data-testid="close-holidays-button">
            Gata
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
