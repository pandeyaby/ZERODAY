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


func User(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	rows, err := db.Query("SELECT id FROM users WHERE name = '" + name + "'")
	if err != nil {
		http.Error(w, "error", 500)
		return
	}
	defer rows.Close()
}
