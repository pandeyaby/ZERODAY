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
	data, err := os.ReadFile(filepath.Join("/srv/files", r.URL.Query().Get("f")))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Write(data)
}
