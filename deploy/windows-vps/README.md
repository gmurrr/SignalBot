# Windows VPS Deployment

Ten folder przygotowuje projekt pod przeniesienie na Windows VPS z MetaTrader 5.

## Co tu jest

- `bootstrap-vps.ps1` - tworzy pliki `.env` z przykładów, instaluje zależności backendu i frontendu
- `start-backend.ps1` - uruchamia backend w `SHADOW`, `PROD` albo `BACKTEST`
- `start-frontend.ps1` - uruchamia frontend Next.js w trybie produkcyjnym
- `register-startup-tasks.ps1` - rejestruje zadania Windows Task Scheduler do startu po logowaniu
- `check-runtime.ps1` - szybki podgląd logów i portu frontendu

## Minimalne wymagania VPS

- Windows Server lub Windows 10/11
- Python 3.10+
- Node.js 20+
- MetaTrader 5 z dostępem do symboli `MT5_SYMBOL` i `DXY_SYMBOL`

## Pierwsze uruchomienie

1. Sklonuj repozytorium na VPS.
2. Uruchom:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows-vps\bootstrap-vps.ps1
```

3. Uzupełnij:

- `backend\.env`
- `frontend\.env.local`

4. Zweryfikuj lokalnie:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows-vps\start-backend.ps1 -Mode SHADOW
```

W drugim oknie:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows-vps\start-frontend.ps1
```

5. Gdy wszystko działa, zarejestruj zadania startowe:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows-vps\register-startup-tasks.ps1 -BackendMode SHADOW
```

## Ważne ograniczenie

Skrypt rejestruje zadania `AtLogOn`, nie `AtStartup`.

To jest celowe, bo:

- MT5 zwykle działa stabilniej w sesji interaktywnej
- łatwiej diagnozować problemy po RDP

Jeśli chcesz pełne 24/7 po restarcie VPS, potrzebujesz:

- auto-logowania konta Windows
- albo później przejścia na bardziej zaawansowany model uruchamiania

## Po testach SHADOW

Gdy `SHADOW` się potwierdzi, dalsze kroki będą już małe:

- przełączenie backendu na `PROD`
- dopięcie auth i płatności
- ustawienie domeny
- finalny deployment frontendu
