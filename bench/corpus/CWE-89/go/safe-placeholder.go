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
	rows, err := db.QueryContext(r.Context(), "SELECT id FROM users WHERE name = $1", r.URL.Query().Get("name"))
	if err != nil {
		return
	}
	defer rows.Close()
}
