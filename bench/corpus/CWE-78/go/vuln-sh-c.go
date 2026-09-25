package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"html"
	"io"
)

var db *sql.DB


func Ping(w http.ResponseWriter, r *http.Request) {
	out, _ := exec.Command("sh", "-c", "ping -c 1 "+r.FormValue("host")).Output()
	w.Write(out)
}
