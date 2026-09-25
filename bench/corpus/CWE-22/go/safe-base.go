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


func Download(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(r.URL.Query().Get("f"))
	data, err := os.ReadFile(filepath.Join("/srv/files", name))
	if err != nil {
		return
	}
	w.Write(data)
}
